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

export default function typescript (options: any)
{
	options = { ... options };

	let parsedConfig = parseTsConfig();

	console.log("lib:", parsedConfig.options.target, parsedConfig.options.lib);

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

	let printDiagnostics = function(diagnostics: ts.Diagnostic[])
	{
		diagnostics.forEach((diagnostic) =>
		{
			let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
			if (diagnostic.file)
			{
				let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
				console.log(`  Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
			}
			else
			{
				console.log(`  Error: ${message}`);
			}
		});
	};

	return {
		load(_id: string): any
		{
			return ""; // avoiding double loading
		},

		transform(_code: string, id: string): any
		{
			console.log("transform", id);

			let output = services.getEmitOutput(id);

			if (output.emitSkipped)
			{
				let allDiagnostics = services
					.getCompilerOptionsDiagnostics()
					.concat(services.getSyntacticDiagnostics(id))
					.concat(services.getSemanticDiagnostics(id));

				printDiagnostics(allDiagnostics);
				throw new Error(`failed to transpile ${id}`);
			}

			const code: ts.OutputFile = _.find(output.outputFiles, (entry: ts.OutputFile) => _.endsWith(entry.name, ".js") );
			const map: ts.OutputFile = _.find(output.outputFiles, (entry: ts.OutputFile) => _.endsWith(entry.name, ".map") );

			console.log(`code: ${code.name}, map: ${map.name}`);

			return {
				code: code ? code.text : undefined,
				map: map ? map.text : undefined,
			};
		},

		outro(): any
		{
			console.log();
			_.each(parsedConfig.fileNames, (id: string) =>
			{
				let allDiagnostics = services
					.getCompilerOptionsDiagnostics()
					.concat(services.getSyntacticDiagnostics(id))
					.concat(services.getSemanticDiagnostics(id));

				printDiagnostics(allDiagnostics);
			});

			return;
		},
	};
}
