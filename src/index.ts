import { LanguageServiceHost } from "./host";
import { Cache, ICode } from "./cache";
import * as ts from "typescript";
import { createFilter } from "rollup-pluginutils";
import * as fs from "fs";
import * as path from "path";
import { existsSync } from "fs";
import * as _ from "lodash";

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

	if (existsSync(fp))
	{
		return fp;
	}

	const segs = cwd.split(path.sep);
	let len = segs.length;

	while (len--)
	{
		cwd = segs.slice(0, len).join("/");
		fp = cwd + "/" + filename;
		if (existsSync(fp))
		{
			return fp;
		}
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
	const text = ts.sys.readFile(fileName);
	const result = ts.parseConfigFileTextToJson(fileName, text);
	const configParseResult = ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(fileName), getOptionsOverrides(), fileName);

	return configParseResult;
}

interface Message
{
	message: string;
}
interface Context
{
	warn(message: Message): void;
	error(message: Message): void;
}
function printDiagnostics(diagnostics: ts.Diagnostic[])
{
	diagnostics.forEach((diagnostic) =>
	{
		let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
		if (diagnostic.file)
		{
			let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
			console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
		}
		else
			console.log(message);
	});
};

export default function typescript (options: any)
{
	options = { ... options };

	const filter = createFilter(options.include || [ "*.ts+(|x)", "**/*.ts+(|x)" ], options.exclude || [ "*.d.ts", "**/*.d.ts" ]);

	delete options.include;
	delete options.exclude;

	let parsedConfig = parseTsConfig();

	const servicesHost = new LanguageServiceHost(parsedConfig);

	const services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

	const cache = new Cache(process.cwd(), parsedConfig.options, parsedConfig.fileNames);

	return {

		resolveId(importee: string, importer: string)
		{
			cache.setDependency(importee, importer);

			if (importee === TSLIB)
				return "\0" + TSLIB;

			if (!importer)
				return null;

			importer = importer.split("\\").join("/");

			let result = ts.nodeModuleNameResolver(importee, importer, parsedConfig.options, ts.sys);

			if (result.resolvedModule && result.resolvedModule.resolvedFileName)
			{
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

		transform(this: Context, code: string, id: string): ICode | null
		{
			if (!filter(id))
				return null;

			const snapshot = servicesHost.setSnapshot(id, code);

			let result = cache.getCompiled(id, snapshot, () =>
			{
				const output = services.getEmitOutput(id);

				if (output.emitSkipped)
					this.error({ message: `failed to transpile ${id}`});

				const transpiled: ts.OutputFile = _.find(output.outputFiles, (entry: ts.OutputFile) => _.endsWith(entry.name, ".js") );
				const map: ts.OutputFile = _.find(output.outputFiles, (entry: ts.OutputFile) => _.endsWith(entry.name, ".map") );

				return {
					code: transpiled ? transpiled.text : undefined,
					map: map ? JSON.parse(map.text) : { mappings: "" },
				};
			});

			return result;
		},

		outro(): void
		{
			cache.lastDependencySet();

			cache.walkTree((id: string) =>
			{
				const snapshot = servicesHost.getScriptSnapshot(id);
				const diagnostics = cache.getDiagnostics(id, snapshot, () =>
				{
					return services
						.getCompilerOptionsDiagnostics()
						.concat(services.getSyntacticDiagnostics(id))
						.concat(services.getSemanticDiagnostics(id));
				});
				if (diagnostics.length !== 0)
				{
					console.log(id);
					printDiagnostics(diagnostics);
				}
			});
		},
	};
}
