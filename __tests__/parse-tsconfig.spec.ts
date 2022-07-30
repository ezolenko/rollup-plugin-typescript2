import { test, expect } from "@jest/globals";
import * as path from "path";
import { normalizePath as normalize } from "@rollup/pluginutils";

import { makeOptions } from "./fixtures/options";
import { makeContext } from "./fixtures/context";
import { parseTsConfig } from "../src/parse-tsconfig";

const local = (x: string) => normalize(path.resolve(__dirname, x));

const defaultOpts = makeOptions("", "");

test("parseTsConfig", () => {
	const context = makeContext();

	parseTsConfig(context, defaultOpts);

	expect(context.error).not.toBeCalled();
});

test("parseTsConfig - incompatible module", () => {
	const context = makeContext();

	parseTsConfig(context, {
		...defaultOpts,
		tsconfigOverride: { compilerOptions: { module: "none" } },
	});

	expect(context.error).toHaveBeenLastCalledWith(expect.stringContaining("Incompatible tsconfig option. Module resolves to 'None'. This is incompatible with Rollup, please use"));
});

test("parseTsConfig - tsconfig errors", () => {
	const context = makeContext();

	parseTsConfig(context, {
		...defaultOpts,
		tsconfigOverride: {
			include: "should-be-an-array",
		},
	});

	expect(context.error).toHaveBeenLastCalledWith(expect.stringContaining("Compiler option 'include' requires a value of type Array"));
});

test("parseTsConfig - failed to open", () => {
	const context = makeContext();
	const nonExistentTsConfig = "non-existent-tsconfig";

	parseTsConfig(context, {
		...defaultOpts,
		tsconfig: nonExistentTsConfig,
	})

	expect(context.error).toHaveBeenLastCalledWith(expect.stringContaining(`failed to open '${nonExistentTsConfig}`));
});

test("parseTsConfig - failed to parse", () => {
	const context = makeContext();
	const notTsConfigPath = local("fixtures/options.ts"); // a TS file should fail to parse

	parseTsConfig(context, {
		...defaultOpts,
		tsconfig: notTsConfigPath,
	})

	expect(context.error).toHaveBeenLastCalledWith(expect.stringContaining(`failed to parse '${notTsConfigPath}'`));
});
