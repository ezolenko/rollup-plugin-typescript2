import { readFileSync } from "fs";

// The injected id for helpers.
export const TSLIB = "tslib";
export const TSLIB_VIRTUAL = "\0tslib.js";
export let tslibSource: string;
export let tslibVersion: string;

try
{
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const tslibPackage = require("tslib/package.json");
	const tslibPath = require.resolve("tslib/" + tslibPackage.module);
	tslibSource = readFileSync(tslibPath, "utf8");
	tslibVersion = tslibPackage.version;
} catch (e)
{
	console.warn("rpt2: Error loading `tslib` helper library.");
	throw e;
}
