import {findConfigFile, parseConfigFileTextToJson, ParsedCommandLine, parseJsonConfigFileContent, sys} from "typescript";
import {IContext} from "./context";
import {dirname} from "path";
import {printDiagnostics} from "./print-diagnostics";
import {convertDiagnostic} from "./tscache";
import {getOptionsOverrides} from "./get-options-overrides";
import {IOptions} from "./ioptions";

export function parseTsConfig(tsconfig: string, context: IContext, pluginOptions: IOptions): ParsedCommandLine
{
	const fileName = findConfigFile(process.cwd(), sys.fileExists, tsconfig);

	if (!fileName)
		throw new Error(`couldn't find '${tsconfig}' in ${process.cwd()}`);

	const text = sys.readFile(fileName);
	const result = parseConfigFileTextToJson(fileName, text);

	if (result.error) {
		printDiagnostics(context, convertDiagnostic("config", [result.error]));
		throw new Error(`failed to parse ${fileName}`);
	}

	return parseJsonConfigFileContent(result.config, sys, dirname(fileName), getOptionsOverrides(pluginOptions, result.config), fileName);
}
