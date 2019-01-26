import * as tsTypes from "typescript";
import { IOptions } from "./ioptions";
import * as _ from "lodash";

export function getOptionsOverrides({ useTsconfigDeclarationDir, cacheRoot }: IOptions, preParsedTsconfig?: tsTypes.ParsedCommandLine): tsTypes.CompilerOptions
{
	const overrides: tsTypes.CompilerOptions = {
		noEmitHelpers: false,
		importHelpers: true,
		noResolve: false,
		noEmit: false,
		inlineSourceMap: false,
		outDir: `${cacheRoot}/placeholder`, // need an outdir that is different from source or tsconfig parsing trips up. https://github.com/Microsoft/TypeScript/issues/24715
		moduleResolution: tsTypes.ModuleResolutionKind.NodeJs,
		allowNonTsExtensions: true,
	};

	if (preParsedTsconfig)
	{
		if (preParsedTsconfig.options.module === undefined)
			overrides.module = tsTypes.ModuleKind.ES2015;

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
