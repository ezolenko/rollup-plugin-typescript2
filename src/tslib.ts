import { readFileSync } from "fs";

// The injected id for helpers.
export const TSLIB = "tslib";
export let tslibSource: string;
try
{
	// tslint:disable-next-line:no-string-literal no-var-requires
	const tslibPath = require.resolve("tslib/" + require("tslib/package.json")["module"]);
	tslibSource = readFileSync(tslibPath, "utf8");
} catch (e)
{
	console.warn("Error loading `tslib` helper library.");
	throw e;
}
