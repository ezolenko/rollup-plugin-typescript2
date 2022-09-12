import { dirname } from "path";
import * as _ from "lodash";

import { tsModule } from "./tsproxy";
import { RollupContext } from "./context";
import { convertDiagnostic, printDiagnostics } from "./diagnostics";
import { getOptionsOverrides } from "./get-options-overrides";
import { IOptions } from "./ioptions";

export function parseTsConfig(context: RollupContext, pluginOptions: IOptions)
{
	const fileName = tsModule.findConfigFile(pluginOptions.cwd, tsModule.sys.fileExists, pluginOptions.tsconfig);

	// if the value was provided, but no file, fail hard
	if (pluginOptions.tsconfig !== undefined && !fileName)
		context.error(`failed to open '${pluginOptions.tsconfig}'`);

	let loadedConfig: any = {};
	let baseDir = pluginOptions.cwd;
	let configFileName;
	let pretty = true;
	if (fileName)
	{
		const text = tsModule.sys.readFile(fileName)!; // readFile only returns undefined when the file doesn't exist, which we already checked above
		const result = tsModule.parseConfigFileTextToJson(fileName, text);
		pretty = result.config?.pretty ?? pretty;

		if (result.error !== undefined)
		{
			printDiagnostics(context, convertDiagnostic("config", [result.error]), pretty);
			context.error(`failed to parse '${fileName}'`);
		}

		loadedConfig = result.config;
		baseDir = dirname(fileName);
		configFileName = fileName;
	}

	const mergedConfig = {};
	_.merge(mergedConfig, pluginOptions.tsconfigDefaults, loadedConfig, pluginOptions.tsconfigOverride);

	const preParsedTsConfig = tsModule.parseJsonConfigFileContent(mergedConfig, tsModule.sys, baseDir, getOptionsOverrides(pluginOptions), configFileName);
	const compilerOptionsOverride = getOptionsOverrides(pluginOptions, preParsedTsConfig);
	const parsedTsConfig = tsModule.parseJsonConfigFileContent(mergedConfig, tsModule.sys, baseDir, compilerOptionsOverride, configFileName);

	const module = parsedTsConfig.options.module!;
	if (module !== tsModule.ModuleKind.ES2015 && module !== tsModule.ModuleKind.ES2020 && module !== tsModule.ModuleKind.ESNext)
		context.error(`Incompatible tsconfig option. Module resolves to '${tsModule.ModuleKind[module]}'. This is incompatible with Rollup, please use 'module: "ES2015"', 'module: "ES2020"', or 'module: "ESNext"'.`);

	printDiagnostics(context, convertDiagnostic("config", parsedTsConfig.errors), pretty);

	context.debug(`built-in options overrides: ${JSON.stringify(compilerOptionsOverride, undefined, 4)}`);
	context.debug(`parsed tsconfig: ${JSON.stringify(parsedTsConfig, undefined, 4)}`);

	return { parsedTsConfig, fileName };
}
