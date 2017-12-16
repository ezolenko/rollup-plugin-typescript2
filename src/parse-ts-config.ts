import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
import { IContext } from "./context";
import { dirname } from "path";
import { printDiagnostics } from "./print-diagnostics";
import { convertDiagnostic } from "./tscache";
import { getOptionsOverrides } from "./get-options-overrides";
import { IOptions } from "./ioptions";
import * as _ from "lodash";

export function parseTsConfig(tsconfig: string, context: IContext, pluginOptions: IOptions): tsTypes.ParsedCommandLine
{
	const fileName = tsModule.findConfigFile(process.cwd(), tsModule.sys.fileExists, tsconfig);

	if (!fileName)
		throw new Error(`couldn't find '${tsconfig}' in ${process.cwd()}`);

	const text = tsModule.sys.readFile(fileName);
	const result = tsModule.parseConfigFileTextToJson(fileName, text!);

	if (result.error)
	{
		printDiagnostics(context, convertDiagnostic("config", [result.error]), _.get(result.config, "pretty", false));
		throw new Error(`failed to parse ${fileName}`);
	}

	_.merge(result.config, pluginOptions.tsconfigOverride);

	const compilerOptionsOverride = getOptionsOverrides(pluginOptions, result.config);
	const parsedTsConfig = tsModule.parseJsonConfigFileContent(result.config, tsModule.sys, dirname(fileName), compilerOptionsOverride, fileName);

	context.debug(`built-in options overrides: ${JSON.stringify(compilerOptionsOverride, undefined, 4)}`);
	context.debug(`parsed tsconfig: ${JSON.stringify(parsedTsConfig, undefined, 4)}`);

	return parsedTsConfig;
}
