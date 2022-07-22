import * as ts from "typescript";

import { setTypescriptModule } from "../../src/tsproxy";
import { IOptions } from "../../src/ioptions";

setTypescriptModule(ts);

export function makeOptions(cacheDir: string, cwd: string): IOptions {
	return {
		include: ["*.ts+(|x)", "**/*.ts+(|x)"],
		exclude: ["*.d.ts", "**/*.d.ts"],
		check: false,
		verbosity: 5,
		clean: false,
		cacheRoot: cacheDir,
		cwd,
		abortOnError: false,
		rollupCommonJSResolveHack: false,
		typescript: ts,
		objectHashIgnoreUnknownHack: false,
		tsconfigOverride: null,
		useTsconfigDeclarationDir: false,
		tsconfigDefaults: null,
		sourceMapCallback: (id: string, map: string): void => {
			console.log(id + map);
		},
		transformers: [(ls: ts.LanguageService) => {
			console.log(ls);
			return {};
		}],
	};
}
