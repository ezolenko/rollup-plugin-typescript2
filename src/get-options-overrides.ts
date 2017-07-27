import {CompilerOptions, ModuleKind} from "typescript";

export function getOptionsOverrides(): CompilerOptions {
	return {
		module: ModuleKind.ES2015,
		noEmitHelpers: true,
		importHelpers: true,
		noResolve: false,
		outDir: process.cwd(),
	};
}
