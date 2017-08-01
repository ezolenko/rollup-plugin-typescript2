import { CompilerOptions, ModuleKind } from "typescript";
import { IOptions } from "./ioptions";
import { get } from "lodash";

export function getOptionsOverrides({ useTsconfigDeclarationDir }: IOptions, tsConfigJson?: any): CompilerOptions
{
	const declaration = get(tsConfigJson, "compilerOptions.declaration", false);
	return {
		module: ModuleKind.ES2015,
		noEmitHelpers: true,
		importHelpers: true,
		noResolve: false,
		outDir: process.cwd(),
		...(!declaration || useTsconfigDeclarationDir ? {} : {declarationDir: process.cwd()}),
	};
}
