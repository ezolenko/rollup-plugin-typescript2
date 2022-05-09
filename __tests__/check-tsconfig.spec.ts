import { test, expect } from "@jest/globals";
import * as ts from "typescript";

import { setTypescriptModule } from "../src/tsproxy";
import { checkTsConfig } from "../src/check-tsconfig";

setTypescriptModule(ts);

test("checkTsConfig", () => {
	expect(() =>
		checkTsConfig({
			fileNames: [],
			errors: [],
			options: { module: ts.ModuleKind.None },
		}),
	).toThrow(
		`Incompatible tsconfig option. Module resolves to 'None'. This is incompatible with rollup, please use 'module: "ES2015"' or 'module: "ESNext"'.`,
	);

	expect(
		checkTsConfig({
			fileNames: [],
			errors: [],
			options: { module: ts.ModuleKind.ES2015 },
		}),
	).toBeFalsy();

	expect(
		checkTsConfig({
			fileNames: [],
			errors: [],
			options: { module: ts.ModuleKind.ESNext },
		}),
	).toBeFalsy();
});
