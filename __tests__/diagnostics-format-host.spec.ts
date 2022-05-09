import { test, expect } from "@jest/globals";
import * as ts from "typescript";

import { setTypescriptModule } from "../src/tsproxy";
import { formatHost } from "../src/diagnostics-format-host";

setTypescriptModule(ts);

test("formatHost", () => {
	const current = formatHost.getCurrentDirectory();
	expect(current.substr(current.lastIndexOf("/"))).toEqual("/rollup-plugin-typescript2");

	expect(formatHost.getCanonicalFileName("package.json")).toEqual("package.json");
	expect(formatHost.getNewLine()).toEqual(ts.sys.newLine);
});
