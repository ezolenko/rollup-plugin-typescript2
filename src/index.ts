import { IContext, ConsoleContext, IRollupContext, VerbosityLevel } from "./context";
import { LanguageServiceHost } from "./host";
import { Cache, ICode, IDiagnostics } from "./cache";
import * as ts from "typescript";
import { createFilter } from "rollup-pluginutils";
import * as fs from "fs-extra";
import * as path from "path";
import * as _ from "lodash";
import * as colors from "colors/safe";

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

// Gratefully lifted from 'look-up', due to problems using it directly:
//   https://github.com/jonschlinkert/look-up/blob/master/index.js
//   MIT Licenced
function findFile(cwd: string, filename: string)
{
	let fp = cwd ? (cwd + "/" + filename) : filename;

	if (fs.existsSync(fp))
		return fp;

	const segs = cwd.split(path.sep);
	let len = segs.length;

	while (len--)
	{
		cwd = segs.slice(0, len).join("/");
		fp = cwd + "/" + filename;
		if (fs.existsSync(fp))
			return fp;
	}

	return null;
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

function parseTsConfig()
{
	const fileName = findFile(process.cwd(), "tsconfig.json");
	if (!fileName)
		throw new Error(`couldn't find 'tsconfig.json' in ${process.cwd()}`);

	const text = ts.sys.readFile(fileName);
	const result = ts.parseConfigFileTextToJson(fileName, text);
	const configParseResult = ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(fileName), getOptionsOverrides(), fileName);

	return configParseResult;
}

function printDiagnostics(context: IContext, diagnostics: IDiagnostics[])
{
	_.each(diagnostics, (diagnostic) =>
	{
		if (diagnostic.fileLine)
			context.warn(`${diagnostic.fileLine}: ${colors.yellow(diagnostic.flatMessage)}`);
		else
			context.warn(colors.yellow(diagnostic.flatMessage));
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
}

export default function typescript (options: IOptions)
{
	options = { ... options };

	_.defaults(options,
	{
		check: true,
		verbosity: VerbosityLevel.Info,
		clean: false,
		cacheRoot: `${process.cwd()}/.rts2_cache`,
		include: [ "*.ts+(|x)", "**/*.ts+(|x)" ],
		exclude: [ "*.d.ts", "**/*.d.ts" ],
	});

	const filter = createFilter(options.include, options.exclude);

	let parsedConfig = parseTsConfig();

	const servicesHost = new LanguageServiceHost(parsedConfig);

	const services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

	const context = new ConsoleContext(options.verbosity, "rollup-plugin-typescript2: ");

	const cache = new Cache(servicesHost, options.cacheRoot, parsedConfig.options, parsedConfig.fileNames, context);

	if (options.clean)
		cache.clean();

	return {

		resolveId(importee: string, importer: string)
		{
			if (importee === TSLIB)
				return "\0" + TSLIB;

			if (!importer)
				return null;

			importer = importer.split("\\").join("/");

			let result = ts.nodeModuleNameResolver(importee, importer, parsedConfig.options, ts.sys);

			if (result.resolvedModule && result.resolvedModule.resolvedFileName)
			{
				if (filter(result.resolvedModule.resolvedFileName))
					cache.setDependency(result.resolvedModule.resolvedFileName, importer);

				if (_.endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
					return null;

				return result.resolvedModule.resolvedFileName;
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

			const snapshot = servicesHost.setSnapshot(id, code);
			let result = cache.getCompiled(id, snapshot, () =>
			{
				const output = services.getEmitOutput(id);

				if (output.emitSkipped)
					this.error({ message: colors.red(`failed to transpile ${id}`)});

				const transpiled = _.find(output.outputFiles, (entry: ts.OutputFile) => _.endsWith(entry.name, ".js") );
				const map = _.find(output.outputFiles, (entry: ts.OutputFile) => _.endsWith(entry.name, ".map") );

				return {
					code: transpiled ? transpiled.text : undefined,
					map: map ? JSON.parse(map.text) : { mappings: "" },
				};
			});

			return result;
		},

		outro(): void
		{
			cache.compileDone();

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

					const diagnostics = cache.getDiagnostics(id, snapshot, () =>
					{
						return services
							.getCompilerOptionsDiagnostics()
							.concat(services.getSyntacticDiagnostics(id))
							.concat(services.getSemanticDiagnostics(id));
					});

					printDiagnostics(context, diagnostics);
				});
			}

			cache.diagnosticsDone();
		},
	};
}
