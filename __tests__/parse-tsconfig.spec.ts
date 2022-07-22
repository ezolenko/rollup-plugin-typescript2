import { test, expect } from "@jest/globals";
import * as path from "path";

import { makeOptions } from "./fixtures/options";
import { makeStubbedContext } from "./fixtures/context";
import { parseTsConfig } from "../src/parse-tsconfig";

const local = (x: string) => path.resolve(__dirname, x);

const defaultOpts = makeOptions("", "");
const stubbedContext = makeStubbedContext({});

test("parseTsConfig", () => {
	expect(() => parseTsConfig(stubbedContext, defaultOpts)).not.toThrow();
});

test("parseTsConfig - tsconfig errors", () => {
	const data = { error: "" };

	// should not throw when the tsconfig is buggy, but should still print an error (below)
	expect(() => parseTsConfig(makeStubbedContext(data), {
		...defaultOpts,
		tsconfigOverride: {
			include: "should-be-an-array",
		},
	})).not.toThrow();
	expect(data.error).toMatch("Compiler option 'include' requires a value of type Array");
});

test("parseTsConfig - failed to open", () => {
	expect(() => parseTsConfig(stubbedContext, {
		...defaultOpts,
		tsconfig: "non-existent-tsconfig",
	})).toThrow("rpt2: failed to open 'non-existent-tsconfig'");
});

test("parseTsConfig - failed to parse", () => {
	const notTsConfigPath = local("fixtures/options.ts"); // a TS file should fail to parse

	expect(() => parseTsConfig(stubbedContext, {
		...defaultOpts,
		tsconfig: notTsConfigPath,
	})).toThrow(`rpt2: failed to parse '${notTsConfigPath}'`);
});
