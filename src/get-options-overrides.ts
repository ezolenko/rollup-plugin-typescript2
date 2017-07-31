import {CompilerOptions, ModuleKind} from "typescript";
import {IOptions} from "./ioptions";

export function getOptionsOverrides({useTsconfigDeclarationDir}: IOptions): CompilerOptions {
	return {
		module: ModuleKind.ES2015,
		noEmitHelpers: true,
		importHelpers: true,
		noResolve: false,
		outDir: process.cwd(),
		...(useTsconfigDeclarationDir ? {} : {declarationDir: process.cwd()}),
	};
}
