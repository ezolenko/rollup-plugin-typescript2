import { checkTsConfig } from "./check-tsconfig";
import * as ts from "typescript";
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
