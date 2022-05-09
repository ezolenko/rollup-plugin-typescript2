import { createFilter as createRollupFilter} from "@rollup/pluginutils";
import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
import { IOptions } from "./ioptions";
import * as _ from "lodash";
import { join } from "path";
import { IContext } from "./context";

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

		// only set declarationDir if useTsconfigDeclarationDir is enabled
		if (!useTsconfigDeclarationDir)
			overrides.declarationDir = undefined;

		// unsetting sourceRoot if sourceMap is not enabled (in case original tsconfig had inlineSourceMap set that is being unset and would cause TS5051)
		const sourceMap = preParsedTsconfig.options.sourceMap;
		if (!sourceMap)
			overrides.sourceRoot = undefined;
	}

	return overrides;
}

function expandIncludeWithDirs(include: string | string[], dirs: string[])
{
	return _
		.chain(dirs)
		.flatMap((root) =>
		{
			if (include instanceof Array)
				return include.map((x) => join(root, x));
			else
				return join(root, include);
		})
		.uniq()
		.value();
}

export function createFilter(context: IContext, pluginOptions: IOptions, parsedConfig: tsTypes.ParsedCommandLine)
{
	let included = pluginOptions.include;
	let excluded = pluginOptions.exclude;

	if (parsedConfig.options.rootDirs)
	{
		included = expandIncludeWithDirs(included, parsedConfig.options.rootDirs);
		excluded = expandIncludeWithDirs(excluded, parsedConfig.options.rootDirs);
	}

	if (parsedConfig.projectReferences)
	{
		included = _.concat(included, expandIncludeWithDirs(included, parsedConfig.projectReferences.map((x) => x.path)));
		excluded = _.concat(excluded, expandIncludeWithDirs(excluded, parsedConfig.projectReferences.map((x) => x.path)));
	}

	context.debug(() => `included:\n${JSON.stringify(included, undefined, 4)}`);
	context.debug(() => `excluded:\n${JSON.stringify(excluded, undefined, 4)}`);
	return createRollupFilter(included, excluded, { resolve: parsedConfig.options.rootDir });
}
