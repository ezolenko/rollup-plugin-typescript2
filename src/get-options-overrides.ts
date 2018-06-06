import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
import { IOptions } from "./ioptions";
import * as _ from "lodash";

export function getOptionsOverrides({ useTsconfigDeclarationDir, cacheRoot }: IOptions, tsConfigJson?: any): tsTypes.CompilerOptions
{
	const overrides = {
		noEmitHelpers: false,
		importHelpers: true,
		noResolve: false,
		noEmit: false,
		inlineSourceMap: false,
		outDir: `${cacheRoot}/placeholder`, // need an outdir that is different from source or tsconfig parsing trips up. https://github.com/Microsoft/TypeScript/issues/24715
		moduleResolution: tsModule.ModuleResolutionKind.NodeJs,
	};

	const declaration = _.get(tsConfigJson, "compilerOptions.declaration", false);

	if (!declaration)
		(overrides as any).declarationDir = null;
	if (declaration && !useTsconfigDeclarationDir)
		(overrides as any).declarationDir = process.cwd();

	return overrides;
}
