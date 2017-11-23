import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
import { IOptions } from "./ioptions";
import * as _ from "lodash";

export function getOptionsOverrides({ useTsconfigDeclarationDir }: IOptions, tsConfigJson?: any): tsTypes.CompilerOptions
{
	const declaration = _.get(tsConfigJson, "compilerOptions.declaration", false);
	const overrides = {
		module: tsModule.ModuleKind.ES2015,
		noEmitHelpers: true,
		importHelpers: true,
		noResolve: false,
		noEmit: false,
		outDir: process.cwd(),
		moduleResolution: tsModule.ModuleResolutionKind.NodeJs,
		...(!declaration || useTsconfigDeclarationDir ? {} : { declarationDir: process.cwd() }),
	};
	return overrides;
}
