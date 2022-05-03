import * as ts from "typescript";

import { formatHost } from "../src/diagnostics-format-host";

test("formatHost", () => {
	const current = formatHost.getCurrentDirectory();
	expect(current.substr(current.lastIndexOf("/"))).toEqual("/rollup-plugin-typescript2");

	expect(formatHost.getCanonicalFileName("package.json")).toEqual("package.json");
	expect(formatHost.getNewLine()).toEqual(ts.sys.newLine);
});
