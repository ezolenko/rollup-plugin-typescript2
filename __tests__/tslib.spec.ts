import { test, expect, jest } from "@jest/globals";
import * as fs from "fs-extra";

(global as any).console = { warn: jest.fn() };

// the error case _must_ come first because order matters for module mocks
test("tslib - errors", async () => {
	jest.mock("tslib/package.json", () => undefined); // mock the module subpath bc we actually never import "tslib" directly. module mocks only work on exact match
	await expect(import("../src/tslib")).rejects.toThrow();
	expect(console.warn).toBeCalledTimes(1);
});

test("tslib", async () => {
	jest.unmock("tslib/package.json");

	const { tslibVersion, tslibSource } = await import("../src/tslib");
	expect(tslibVersion).toEqual(require("tslib/package.json").version);

	const tslibES6 = await fs.readFile(require.resolve("tslib/tslib.es6.js"), "utf8");
	expect(tslibSource).toEqual(tslibES6);
});
