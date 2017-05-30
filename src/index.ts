import { RollupContext } from "./rollupcontext";
import { IContext, ConsoleContext, IRollupContext, VerbosityLevel } from "./context";
import { LanguageServiceHost } from "./host";
import { TsCache, convertDiagnostic, ICode, IDiagnostics } from "./tscache";
import * as ts from "typescript";
import * as fs from "fs-extra";
import * as path from "path";
import * as _ from "lodash";
import * as colors from "colors/safe";
import * as resolve from "resolve";

// tslint:disable-next-line:no-var-requires
const createFilter = require("rollup-pluginutils").createFilter;

function getOptionsOverrides(): ts.CompilerOptions
{
	return {
		module: ts.ModuleKind.ES2015,
		noEmitHelpers: true,
		importHelpers: true,
		noResolve: false,
	};
}

// The injected id for helpers.
const TSLIB = "tslib";
let tslibSource: string;
try
{
	// tslint:disable-next-line:no-string-literal no-var-requires
	const tslibPath = require.resolve("tslib/" + require("tslib/package.json")["module"]);
	tslibSource = fs.readFileSync(tslibPath, "utf8");
} catch (e)
{
	console.warn("Error loading `tslib` helper library.");
	throw e;
}

function parseTsConfig(context: IContext)
{
	const fileName = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");

	if (!fileName)
		throw new Error(`couldn't find 'tsconfig.json' in ${process.cwd()}`);

	const text = ts.sys.readFile(fileName);
	const result = ts.parseConfigFileTextToJson(fileName, text);

	if (result.error)
	{
		printDiagnostics(context, convertDiagnostic("config", [result.error]));
		throw new Error(`failed to parse ${fileName}`);
	}

	const configParseResult = ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(fileName), getOptionsOverrides(), fileName);

	return configParseResult;
}

function printDiagnostics(context: IContext, diagnostics: IDiagnostics[])
{
	_.each(diagnostics, (diagnostic) =>
	{
		let print;
		let color;
		let category;
		switch (diagnostic.category)
		{
			case ts.DiagnosticCategory.Message:
				print = context.info;
				color = colors.white;
				category = "";
				break;
			case ts.DiagnosticCategory.Error:
				print = context.error;
				color = colors.red;
				category = "error";
				break;
			case ts.DiagnosticCategory.Warning:
			default:
				print = context.warn;
				color = colors.yellow;
				category = "warning";
				break;
		}

		// const type = "";
		const type = diagnostic.type + " ";

		if (diagnostic.fileLine)
			print.call(context, [`${diagnostic.fileLine}: ${type}${category} TS${diagnostic.code} ${color(diagnostic.flatMessage)}`]);
		else
			print.call(context, [`${type}${category} TS${diagnostic.code} ${color(diagnostic.flatMessage)}`]);
	});
}

export interface IOptions
{
	include: string;
	exclude: string;
	check: boolean;
	verbosity: number;
	clean: boolean;
	cacheRoot: string;
	abortOnError: boolean;
	rollupCommonJSResolveHack: boolean;
}

export default function typescript(options: IOptions)
{
	options = { ... options };

	_.defaults(options,
	{
		check: true,
		verbosity: VerbosityLevel.Warning,
		clean: false,
		cacheRoot: `${process.cwd()}/.rpt2_cache`,
		include: [ "*.ts+(|x)", "**/*.ts+(|x)" ],
		exclude: [ "*.d.ts", "**/*.d.ts" ],
		abortOnError: true,
		rollupCommonJSResolveHack: false,
	});

	let rollupConfig: any;

	let watchMode = false;
	let round = 0;
	let targetCount = 0;

	const context = new ConsoleContext(options.verbosity, "rpt2: ");

	context.info(`Typescript version: ${ts.version}`);
	context.debug(`Options: ${JSON.stringify(options, undefined, 4)}`);

	const filter = createFilter(options.include, options.exclude);

	const parsedConfig = parseTsConfig(context);

	const servicesHost = new LanguageServiceHost(parsedConfig);

	const service = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

	let _cache: TsCache;

	const cache = (): TsCache =>
	{
		if (!_cache)
			_cache = new TsCache(servicesHost, options.cacheRoot, parsedConfig.options, rollupConfig, parsedConfig.fileNames, context);
		return _cache;
	};

	let noErrors = true;

	const declarations: { [name: string]: ts.OutputFile } = {};

	// printing compiler option errors
	if (options.check)
		printDiagnostics(context, convertDiagnostic("options", service.getCompilerOptionsDiagnostics()));

	return {

		options(config: any)
		{
			rollupConfig = config;

			context.debug(`rollupConfig: ${JSON.stringify(rollupConfig, undefined, 4)}`);

			if (options.clean)
				cache().clean();
		},

		resolveId(importee: string, importer: string)
		{
			if (importee === TSLIB)
				return "\0" + TSLIB;

			if (!importer)
				return null;

			importer = importer.split("\\").join("/");

			// TODO: use module resolution cache
			const result = ts.nodeModuleNameResolver(importee, importer, parsedConfig.options, ts.sys);

			if (result.resolvedModule && result.resolvedModule.resolvedFileName)
			{
				if (filter(result.resolvedModule.resolvedFileName))
					cache().setDependency(result.resolvedModule.resolvedFileName, importer);

				if (_.endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
					return null;

				const resolved = options.rollupCommonJSResolveHack
						? resolve.sync(result.resolvedModule.resolvedFileName)
						: result.resolvedModule.resolvedFileName;

				context.debug(`${colors.blue("resolving")} '${importee}'`);
				context.debug(`    to '${resolved}'`);

				return resolved;
			}

			return null;
		},

		load(id: string): string | undefined
		{
			if (id === "\0" + TSLIB)
				return tslibSource;

			return undefined;
		},

		transform(this: IRollupContext, code: string, id: string): ICode | undefined
		{
			if (!filter(id))
				return undefined;

			const contextWrapper = new RollupContext(options.verbosity, options.abortOnError, this, "rpt2: ");

			const snapshot = servicesHost.setSnapshot(id, code);

			// getting compiled file from cache or from ts
			const result = cache().getCompiled(id, snapshot, () =>
			{
				const output = service.getEmitOutput(id);

				if (output.emitSkipped)
				{
					noErrors = false;

					// always checking on fatal errors, even if options.check is set to false
					const diagnostics = _.concat(
						cache().getSyntacticDiagnostics(id, snapshot, () =>
						{
							return service.getSyntacticDiagnostics(id);
						}),
						cache().getSemanticDiagnostics(id, snapshot, () =>
						{
							return service.getSemanticDiagnostics(id);
						}),
					);
					printDiagnostics(contextWrapper, diagnostics);

					// since no output was generated, aborting compilation
					cache().done();
					if (_.isFunction(this.error))
						this.error(colors.red(`failed to transpile '${id}'`));
				}

				const transpiled = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".js"));
				const map = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".map"));
				const dts = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".d.ts"));

				return {
					code: transpiled ? transpiled.text : undefined,
					map: map ? JSON.parse(map.text) : { mappings: "" },
					dts,
				};
			});

			if (options.check)
			{
				const diagnostics = _.concat(
					cache().getSyntacticDiagnostics(id, snapshot, () =>
					{
						return service.getSyntacticDiagnostics(id);
					}),
					cache().getSemanticDiagnostics(id, snapshot, () =>
					{
						return service.getSemanticDiagnostics(id);
					}),
				);

				if (diagnostics.length > 0)
					noErrors = false;

				printDiagnostics(contextWrapper, diagnostics);
			}

			if (result && result.dts)
			{
				declarations[result.dts.name] = result.dts;
				result.dts = undefined;
			}

			return result;
		},

		ongenerate(bundleOptions: any): void
		{
			targetCount = _.get(bundleOptions, "targets.length", 1);

			if (round >= targetCount) // ongenerate() is called for each target
			{
				watchMode = true;
				round = 0;
			}
			context.debug(`generating target ${round + 1} of ${targetCount}`);

			if (watchMode && round === 0)
			{
				context.debug("running in watch mode");

				cache().walkTree((id) =>
				{
					const diagnostics = _.concat(
						convertDiagnostic("syntax", service.getSyntacticDiagnostics(id)),
						convertDiagnostic("semantic", service.getSemanticDiagnostics(id)),
					);

					printDiagnostics(context, diagnostics);
				});
			}

			if (!watchMode && !noErrors)
				context.info(colors.yellow("there were errors or warnings above."));

			cache().done();

			round++;
		},

		onwrite()
		{
			_.each(declarations, ({ name, text, writeByteOrderMark }) =>
			{
				ts.sys.writeFile(name, text, writeByteOrderMark);
			});
		},
	};
}
