import * as ts from "typescript";
import { createFilter } from "rollup-pluginutils";
import * as fs from "fs";
import * as path from "path";
import { existsSync } from "fs";
const _ = require("lodash") as lodash;

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

function parseTsConfig()
{
	const fileName = findFile(process.cwd(), "tsconfig.json");
	const text = ts.sys.readFile(fileName);
	const result = ts.parseConfigFileTextToJson(fileName, text);
	const configParseResult = ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(fileName), undefined, fileName);

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
function printDiagnostics(context: Context,  diagnostics: ts.Diagnostic[])
{
	diagnostics.forEach((diagnostic) =>
	{
		let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
		if (diagnostic.file)
		{
			let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
			context.warn({ message: `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}` });
		}
		else
			context.warn({ message });
	});
};

export default function typescript (options: any)
{
	options = { ... options };

	const filter = createFilter(options.include || [ "*.ts+(|x)", "**/*.ts+(|x)" ], options.exclude || [ "*.d.ts", "**/*.d.ts" ]);

	delete options.include;
	delete options.exclude;

	let parsedConfig = parseTsConfig();

	if (parsedConfig.options.module !== ts.ModuleKind.ES2015)
		throw new Error( `rollup-plugin-typescript2: The module kind should be 'es2015', found: '${ts.ModuleKind[parsedConfig.options.module]}'` );

	const servicesHost: ts.LanguageServiceHost = {
		getScriptFileNames: () => parsedConfig.fileNames,
		getScriptVersion: (_fileName) => "0",
		getScriptSnapshot: (fileName) =>
		{
			if (!fs.existsSync(fileName))
				return undefined;

			return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName));
		},
		getCurrentDirectory: () => process.cwd(),
		getCompilationSettings: () => parsedConfig.options,
		getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
	};

	const services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

	return {

		resolveId(importee: string, importer: string)
		{
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

		load(id: string): any
		{
			if (!filter(id))
				return null;
			return ""; // avoiding double loading
		},

		transform(this: Context, _code: string, id: string): any
		{
			if (!filter(id)) return null;

			let output = services.getEmitOutput(id);

			let allDiagnostics = services
				.getCompilerOptionsDiagnostics()
				.concat(services.getSyntacticDiagnostics(id))
				.concat(services.getSemanticDiagnostics(id));

			printDiagnostics(this, allDiagnostics);

			if (output.emitSkipped)
				this.error({ message: `failed to transpile ${id}`});

			const code: ts.OutputFile = _.find(output.outputFiles, (entry: ts.OutputFile) => _.endsWith(entry.name, ".js") );
			const map: ts.OutputFile = _.find(output.outputFiles, (entry: ts.OutputFile) => _.endsWith(entry.name, ".map") );

			return {
				code: code ? code.text : undefined,
				map: map ? JSON.parse(map.text) : { mappings: "" },
			};
		},
	};
}
