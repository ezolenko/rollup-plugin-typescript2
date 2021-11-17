import { readFileSync } from "fs";

// The injected id for helpers.
export const TSLIB = "tslib";
export const TSLIB_VIRTUAL = "\0tslib.js";
export let tslibSource: string;
export let tslibVersion: string;
try
{
	// tslint:disable-next-line:no-string-literal no-var-requires
	const _ = require("@yarn-tool/resolve-package").resolvePackage('tslib');
	const tslibPackage = _.pkg;
	const tslibPath = _.resolveLocation(tslibPackage.module);
	tslibSource = readFileSync(tslibPath, "utf8");
	tslibVersion = tslibPackage.version;
} catch (e)
{
	console.warn("Error loading `tslib` helper library.");
	throw e;
}
