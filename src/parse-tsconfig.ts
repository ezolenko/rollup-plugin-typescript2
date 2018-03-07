import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
import { IContext } from "./context";
import { dirname } from "path";
import { printDiagnostics } from "./print-diagnostics";
import { convertDiagnostic } from "./tscache";
import { getOptionsOverrides } from "./get-options-overrides";
import { IOptions } from "./ioptions";
import * as _ from "lodash";
import { checkTsConfig } from "./check-tsconfig";
import { getOptionsDefaults } from "./get-option-defaults";

export function parseTsConfig(context: IContext, pluginOptions: IOptions): tsTypes.ParsedCommandLine
{
	const fileName = tsModule.findConfigFile(process.cwd(), tsModule.sys.fileExists, pluginOptions.tsconfig);

	// if the value was provided, but no file, fail hard
	if (pluginOptions.tsconfig !== undefined && !fileName)
		throw new Error(`failed to open '${fileName}'`);

	let loadedConfig: any = {};
	let baseDir = process.cwd();
	let configFileName;
	if (fileName)
	{
		const text = tsModule.sys.readFile(fileName);
		if (text === undefined)
			throw new Error(`failed to read '${fileName}'`);

		const result = tsModule.parseConfigFileTextToJson(fileName, text);

		if (result.error !== undefined)
		{
			printDiagnostics(context, convertDiagnostic("config", [result.error]), _.get(result.config, "pretty", false));
			throw new Error(`failed to parse '${fileName}'`);
		}

		loadedConfig = result.config;
		baseDir = dirname(fileName);
		configFileName = fileName;
	}

	const mergedConfig = {};
	_.merge(mergedConfig, getOptionsDefaults(), pluginOptions.tsconfigDefaults, loadedConfig, pluginOptions.tsconfigOverride);

	const compilerOptionsOverride = getOptionsOverrides(pluginOptions, mergedConfig);
	const parsedTsConfig = tsModule.parseJsonConfigFileContent(mergedConfig, tsModule.sys, baseDir, compilerOptionsOverride, configFileName);

	checkTsConfig(parsedTsConfig);

	context.debug(`built-in options overrides: ${JSON.stringify(compilerOptionsOverride, undefined, 4)}`);
	context.debug(`parsed tsconfig: ${JSON.stringify(parsedTsConfig, undefined, 4)}`);

	return parsedTsConfig;
}
