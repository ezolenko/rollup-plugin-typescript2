import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
import { IOptions } from "./ioptions";
import * as _ from "lodash";
import { join } from "path";
import { IContext } from "./context";

// tslint:disable-next-line:no-var-requires
const createRollupFilter = require("rollup-pluginutils").createFilter;

export function getOptionsOverrides({ useTsconfigDeclarationDir, cacheRoot }: IOptions, preParsedTsconfig?: tsTypes.ParsedCommandLine): tsTypes.CompilerOptions
{
	const overrides: tsTypes.CompilerOptions = {
		noEmitHelpers: false,
		importHelpers: true,
		noResolve: false,
		noEmit: false,
		inlineSourceMap: false,
		outDir: `${cacheRoot}/placeholder`, // need an outdir that is different from source or tsconfig parsing trips up. https://github.com/Microsoft/TypeScript/issues/24715
		moduleResolution: tsModule.ModuleResolutionKind.NodeJs,
		allowNonTsExtensions: true,
	};

	if (preParsedTsconfig)
	{
		if (preParsedTsconfig.options.module === undefined)
			overrides.module = tsModule.ModuleKind.ES2015;

		const declaration = preParsedTsconfig.options.declaration;
		if (!declaration)
			overrides.declarationDir = undefined;
		if (declaration && !useTsconfigDeclarationDir)
			overrides.declarationDir = process.cwd();

		// unsetting sourceRoot if sourceMap is not enabled (in case original tsconfig had inlineSourceMap set that is being unset and would cause TS5051)
		const sourceMap = preParsedTsconfig.options.sourceMap;
		if (!sourceMap)
			overrides.sourceRoot = undefined;
	}

	return overrides;
}

export function createFilter(context: IContext, pluginOptions: IOptions, parsedConfig: tsTypes.ParsedCommandLine)
{
	if (parsedConfig.options.rootDirs)
	{
		const included = _
			.chain(parsedConfig.options.rootDirs)
			.flatMap((root) =>
			{
				if (pluginOptions.include instanceof Array)
					return pluginOptions.include.map((include) => join(root, include));
				else
					return join(root, pluginOptions.include);
			})
			.uniq()
			.value();

		const excluded = _
			.chain(parsedConfig.options.rootDirs)
			.flatMap((root) =>
			{
				if (pluginOptions.exclude instanceof Array)
					return pluginOptions.exclude.map((exclude) => join(root, exclude));
				else
					return join(root, pluginOptions.exclude);
			})
			.uniq()
			.value();

		context.debug(() => `included:\n${JSON.stringify(included, undefined, 4)}`);
		context.debug(() => `excluded:\n${JSON.stringify(excluded, undefined, 4)}`);
		return createRollupFilter(included, excluded);
	}
	else
	{
		context.debug(() => `included:\n'${JSON.stringify(pluginOptions.include, undefined, 4)}'`);
		context.debug(() => `excluded:\n'${JSON.stringify(pluginOptions.exclude, undefined, 4)}'`);
		return createRollupFilter(pluginOptions.include, pluginOptions.exclude);
	}
}
