import * as ts from "typescript";
import { createFilter } from "rollup-pluginutils";
import * as fs from "fs";
import * as path from "path";
import { existsSync, readFileSync } from "fs";
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

export default function typescript (options: any)
{
	options = { ... options };

	const filter = createFilter(options.include || ["*.ts+(|x)", "**/*.ts+(|x)"], options.exclude || ["*.d.ts", "**/*.d.ts"]);

	// Verify that we're targeting ES2015 modules.
	if ( options.module !== "es2015" && options.module !== "es6" )
		throw new Error( `rollup-plugin-typescript2: The module kind should be 'es2015', found: '${ options.module }'` );

	const cwd = process.cwd();

	let typescript = ts;
	let config = typescript.readConfigFile(findFile(cwd, "tsconfig.json"), (path) => readFileSync(path, "utf8"));
	let compilerOptions = config.config.compilerOptions;

	let files: { [id: string]: string } = {};

	const servicesHost: ts.LanguageServiceHost = {
		getScriptFileNames: () => _.keys(files),
		getScriptVersion: (_fileName) => "0",
		getScriptSnapshot: (fileName) =>
		{
			if (!fs.existsSync(fileName))
				return undefined;

			return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
		},
		getCurrentDirectory: () => process.cwd(),
		getCompilationSettings: () => compilerOptions,
		getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
	};

	const services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

	return {
		load(id: string): any
		{
			if (!filter(id)) return;

			return ""; // avoiding double loading
		},

		transform(_code: string, id: string): any
		{
			if (!filter(id)) return;

			files[id] = "";

			let output = services.getEmitOutput(id);

			if (output.emitSkipped)
				throw new Error(`failed to transpile ${id}`);

			return {
				code: output.outputFiles[0],
				map: output.outputFiles[1],
			};
		},

		outro(): any
		{
			_.each(_.keys(files), (id) =>
			{
				let allDiagnostics = services
					.getCompilerOptionsDiagnostics()
					.concat(services.getSyntacticDiagnostics(id))
					.concat(services.getSemanticDiagnostics(id));

				allDiagnostics.forEach((diagnostic) =>
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
			});

			return;
		},
	};
}
