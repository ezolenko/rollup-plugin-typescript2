import { test, expect } from "@jest/globals";
import * as ts from "typescript";

import { setTypescriptModule } from "../src/tsproxy";
import { formatHost } from "../src/diagnostics-format-host";

setTypescriptModule(ts);

test("formatHost", () => {
	expect(formatHost.getCurrentDirectory()).toEqual(process.cwd());
	expect(formatHost.getCanonicalFileName("package.json")).toEqual("package.json");
	expect(formatHost.getNewLine()).toEqual(ts.sys.newLine);
});
