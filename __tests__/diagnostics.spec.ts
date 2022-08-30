import { test, expect } from "@jest/globals";
import * as ts from "typescript";
import { red } from "colors/safe";

import { makeContext } from "./fixtures/context";
import { setTypescriptModule } from "../src/tsproxy";
import { printDiagnostics } from "../src/diagnostics";

setTypescriptModule(ts);

const diagnostic = {
	flatMessage: "Compiler option 'include' requires a value of type Array.",
	formatted: "\x1B[91merror\x1B[0m\x1B[90m TS5024: \x1B[0mCompiler option 'include' requires a value of type Array.\n",
	category: ts.DiagnosticCategory.Error,
	code: 5024,
	type: 'config'
};

test("printDiagnostics - categories", () => {
	const context = makeContext();

	printDiagnostics(context, [diagnostic]);
	expect(context.error).toHaveBeenLastCalledWith(diagnostic.formatted);

	printDiagnostics(context, [{ ...diagnostic, category: ts.DiagnosticCategory.Warning } ]);
	expect(context.warn).toHaveBeenLastCalledWith(diagnostic.formatted);

	printDiagnostics(context, [{ ...diagnostic, category: ts.DiagnosticCategory.Suggestion } ]); // default case
	expect(context.warn).toHaveBeenLastCalledWith(diagnostic.formatted);

	printDiagnostics(context, [{ ...diagnostic, category: ts.DiagnosticCategory.Message } ]);
	expect(context.info).toHaveBeenLastCalledWith(diagnostic.formatted);

	// should match exactly, no more
	expect(context.error).toBeCalledTimes(1);
	expect(context.warn).toBeCalledTimes(2)
	expect(context.info).toBeCalledTimes(1);
	expect(context.debug).toBeCalledTimes(0);
});

test("printDiagnostics - formatting / style", () => {
	const context = makeContext();
	const category = "error"; // string version

	printDiagnostics(context, [diagnostic], false);
	expect(context.error).toHaveBeenLastCalledWith(`${diagnostic.type} ${category} TS${diagnostic.code}: ${red(diagnostic.flatMessage)}`);

	const fileLine = "0"
	printDiagnostics(context, [{ ...diagnostic, fileLine }], false);
	expect(context.error).toHaveBeenLastCalledWith(`${fileLine}: ${diagnostic.type} ${category} TS${diagnostic.code}: ${red(diagnostic.flatMessage)}`);

	// should match exactly, no more
	expect(context.error).toBeCalledTimes(2);
	expect(context.warn).toBeCalledTimes(0)
	expect(context.info).toBeCalledTimes(0);
	expect(context.debug).toBeCalledTimes(0);
});
