import { RollupContext } from "./rollupcontext";
import { IContext, ConsoleContext, IRollupContext, VerbosityLevel } from "./context";
import { LanguageServiceHost } from "./host";
import { Cache, convertDiagnostic, ICode, IDiagnostics } from "./cache";
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
		sourceMap: true,
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
		verbosity: VerbosityLevel.Info,
		clean: false,
		cacheRoot: `${process.cwd()}/.rpt2_cache`,
		include: [ "*.ts+(|x)", "**/*.ts+(|x)" ],
		exclude: [ "*.d.ts", "**/*.d.ts" ],
		abortOnError: true,
	});

	const context = new ConsoleContext(options.verbosity, "rpt2: ");

	const filter = createFilter(options.include, options.exclude);

	const parsedConfig = parseTsConfig(context);

	const servicesHost = new LanguageServiceHost(parsedConfig);

	const services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

	const cache = new Cache(servicesHost, options.cacheRoot, parsedConfig.options, parsedConfig.fileNames, context);

	if (options.clean)
		cache.clean();

	// printing compiler option errors
	if (options.check)
		printDiagnostics(context, convertDiagnostic(services.getCompilerOptionsDiagnostics()));

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

				context.debug(`resolving ${importee} to ${resolved}`);

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

			// getting compiled file from cache of from ts
			const result = cache.getCompiled(id, snapshot, () =>
			{
				const output = services.getEmitOutput(id);

				if (output.emitSkipped)
				{
					if (options.check)
					{
						const diagnostics = cache.getSyntacticDiagnostics(id, snapshot, () =>
						{
							return services.getSyntacticDiagnostics(id);
						});
						printDiagnostics(contextWrapper, diagnostics);
					}

					// if no output was generated, aborting compilation
					this.error(colors.red(`failed to transpile ${id}`));
				}

				const transpiled = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".js") );
				const map = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".map") );

				return {
					code: transpiled ? transpiled.text : undefined,
					map: map ? JSON.parse(map.text) : { mappings: "" },
				};
			});

			// printing syntactic errors
			if (options.check)
			{
				const diagnostics = cache.getSyntacticDiagnostics(id, snapshot, () =>
				{
					return services.getSyntacticDiagnostics(id);
				});
				printDiagnostics(contextWrapper, diagnostics);
			}

			return result;
		},

		outro(): void
		{
			context.debug("outro");

			cache.compileDone();

			// printing semantic errors
			if (options.check)
			{
				cache.walkTree((id: string) =>
				{
					const snapshot = servicesHost.getScriptSnapshot(id);

					if (!snapshot)
					{
						context.error(colors.red(`failed lo load snapshot for ${id}`));
						return;
					}

					const diagnostics = cache.getSemanticDiagnostics(id, snapshot, () =>
					{
						return services.getSemanticDiagnostics(id);
					});

					printDiagnostics(context, diagnostics);
				});
			}

			cache.diagnosticsDone();
		},
	};
}
