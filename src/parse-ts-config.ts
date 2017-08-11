import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
import { IContext } from "./context";
import { dirname } from "path";
import { printDiagnostics } from "./print-diagnostics";
import { convertDiagnostic } from "./tscache";
import { getOptionsOverrides } from "./get-options-overrides";
import { IOptions } from "./ioptions";

export function parseTsConfig(tsconfig: string, context: IContext, pluginOptions: IOptions): tsTypes.ParsedCommandLine
{
	const fileName = tsModule.findConfigFile(process.cwd(), tsModule.sys.fileExists, tsconfig);

	if (!fileName)
		throw new Error(`couldn't find '${tsconfig}' in ${process.cwd()}`);

	const text = tsModule.sys.readFile(fileName);
	const result = tsModule.parseConfigFileTextToJson(fileName, text);

	if (result.error)
	{
		printDiagnostics(context, convertDiagnostic("config", [result.error]));
		throw new Error(`failed to parse ${fileName}`);
	}

	return tsModule.parseJsonConfigFileContent(result.config, tsModule.sys, dirname(fileName), getOptionsOverrides(pluginOptions, result.config), fileName);
}
