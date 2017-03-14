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
		printDiagnostics(context, convertDiagnostic([result.error]));
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
		switch (diagnostic.category)
		{
			case ts.DiagnosticCategory.Message:
				print = context.info;
				color = colors.white;
				break;
			case ts.DiagnosticCategory.Error:
				print = context.error;
				color = colors.red;
				break;
			case ts.DiagnosticCategory.Warning:
			default:
				print = context.warn;
				color = colors.yellow;
				break;
		}

		if (diagnostic.fileLine)
			print.call(context, [`${diagnostic.fileLine}: ${color(diagnostic.flatMessage)}`]);
		else
			print.call(context, [color(diagnostic.flatMessage)]);
	});
};

interface IOptions
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

export default function typescript (options: IOptions)
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

	let watchMode = false;
	let round = 0;
	let targetCount = 0;

	const context = new ConsoleContext(options.verbosity, "rpt2: ");

	context.info(`Typescript version: ${ts.version}`);
	context.debug(`Options: ${JSON.stringify(options, undefined, 4)}`);

	const filter = createFilter(options.include, options.exclude);

	const parsedConfig = parseTsConfig(context);

	let servicesHost = new LanguageServiceHost(parsedConfig);

	let service = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

	const cache = new TsCache(servicesHost, options.cacheRoot, parsedConfig.options, parsedConfig.fileNames, context);

	let noErrors = true;

	if (options.clean)
		cache.clean();

	// printing compiler option errors
	if (options.check)
		printDiagnostics(context, convertDiagnostic(service.getCompilerOptionsDiagnostics()));

	return {

		resolveId(importee: string, importer: string)
		{
			if (importee === TSLIB)
				return "\0" + TSLIB;

			if (!importer)
				return null;

			importer = importer.split("\\").join("/");

			const result = ts.nodeModuleNameResolver(importee, importer, parsedConfig.options, ts.sys);

			if (result.resolvedModule && result.resolvedModule.resolvedFileName)
			{
				if (filter(result.resolvedModule.resolvedFileName))
					cache.setDependency(result.resolvedModule.resolvedFileName, importer);

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
			const result = cache.getCompiled(id, snapshot, () =>
			{
				const output = service.getEmitOutput(id);

				if (output.emitSkipped)
				{
					noErrors = false;

					// always checking on fatal errors, even if options.check is set to false
					const diagnostics = cache.getSyntacticDiagnostics(id, snapshot, () =>
					{
						return service.getSyntacticDiagnostics(id);
					}).concat(cache.getSemanticDiagnostics(id, snapshot, () =>
					{
						return service.getSemanticDiagnostics(id);
					}));
					printDiagnostics(contextWrapper, diagnostics);

					// since no output was generated, aborting compilation
					this.error(colors.red(`failed to transpile '${id}'`));
				}

				const transpiled = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".js") );
				const map = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".map") );

				return {
					code: transpiled ? transpiled.text : undefined,
					map: map ? JSON.parse(map.text) : { mappings: "" },
				};
			});

			if (options.check)
			{
				const diagnostics = cache.getSyntacticDiagnostics(id, snapshot, () =>
				{
					return service.getSyntacticDiagnostics(id);
				}).concat(cache.getSemanticDiagnostics(id, snapshot, () =>
				{
					return service.getSemanticDiagnostics(id);
				}));

				if (diagnostics.length !== 0)
					noErrors = false;

				printDiagnostics(contextWrapper, diagnostics);
			}

			return result;
		},

		ongenerate(bundleOptions: any): void
		{
			if (_.isArray(bundleOptions.targets))
				targetCount = bundleOptions.targets.length;

			if (round >= targetCount) // ongenerate() is called for each target
			{
				watchMode = true;
				round = 0;
			}
			context.debug(`generating target ${round} of ${bundleOptions.targets.length}`);

			if (watchMode && round === 0)
			{
				context.debug("running in watch mode");

				// hack to fix ts lagging
				servicesHost.reset();
				service.cleanupSemanticCache();

				cache.walkTree((id) =>
				{
					const diagnostics = convertDiagnostic(service.getSyntacticDiagnostics(id)).concat(convertDiagnostic(service.getSemanticDiagnostics(id)));

					if (diagnostics.length > 0)
						noErrors = false;

					printDiagnostics(context, diagnostics);
				});

			}

			if (!noErrors)
			{
				noErrors = true;
				context.info(colors.yellow("there were errors or warnings above."));
			}

			cache.done();

			round++;
		},
	};
}
