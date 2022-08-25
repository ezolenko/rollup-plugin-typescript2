import { test, expect } from "@jest/globals";
import * as path from "path";
import { normalizePath as normalize } from "@rollup/pluginutils";

import { makeOptions } from "./fixtures/options";
import { makeContext } from "./fixtures/context";
import { parseTsConfig } from "../src/parse-tsconfig";

const local = (x: string) => normalize(path.resolve(__dirname, x));

const defaultOpts = makeOptions("", "");

test("parseTsConfig", () => {
	expect(() => parseTsConfig(makeContext(), defaultOpts)).not.toThrow();
});

test("parseTsConfig - incompatible module", () => {
	expect(() => parseTsConfig(makeContext(), {
		...defaultOpts,
		tsconfigOverride: { compilerOptions: { module: "none" } },
	})).toThrow("Incompatible tsconfig option. Module resolves to 'None'. This is incompatible with Rollup, please use");
});

test("parseTsConfig - tsconfig errors", () => {
	const context = makeContext();

	// should not throw when the tsconfig is buggy, but should still print an error (below)
	expect(() => parseTsConfig(context, {
		...defaultOpts,
		tsconfigOverride: {
			include: "should-be-an-array",
		},
	})).not.toThrow();
	expect(context.error).toHaveBeenLastCalledWith(expect.stringContaining("Compiler option 'include' requires a value of type Array"));
});

test("parseTsConfig - failed to open", () => {
	expect(() => parseTsConfig(makeContext(), {
		...defaultOpts,
		tsconfig: "non-existent-tsconfig",
	})).toThrow("rpt2: failed to open 'non-existent-tsconfig'");
});

test("parseTsConfig - failed to parse", () => {
	const notTsConfigPath = local("fixtures/options.ts"); // a TS file should fail to parse

	expect(() => parseTsConfig(makeContext(), {
		...defaultOpts,
		tsconfig: notTsConfigPath,
	})).toThrow(`rpt2: failed to parse '${notTsConfigPath}'`);
});
