import * as tsTypes from "typescript";
import { red, white, yellow } from "colors/safe";

import { tsModule } from "./tsproxy";
import { RollupContext } from "./context";
import { formatHost } from "./diagnostics-format-host";

export interface IDiagnostics
{
	flatMessage: string;
	formatted: string;
	fileLine?: string;
	category: tsTypes.DiagnosticCategory;
	code: number;
	type: string;
}

export function convertDiagnostic(type: string, data: tsTypes.Diagnostic[]): IDiagnostics[]
{
	return data.map((diagnostic) =>
	{
		const entry: IDiagnostics = {
			flatMessage: tsModule.flattenDiagnosticMessageText(diagnostic.messageText, formatHost.getNewLine()),
			formatted: tsModule.formatDiagnosticsWithColorAndContext(data, formatHost),
			category: diagnostic.category,
			code: diagnostic.code,
			type,
		};

		if (diagnostic.file && diagnostic.start !== undefined)
		{
			const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
			entry.fileLine = `${diagnostic.file.fileName}(${line + 1},${character + 1})`;
		}

		return entry;
	});
}

export function printDiagnostics(context: RollupContext, diagnostics: IDiagnostics[], pretty = true): void
{
	diagnostics.forEach((diagnostic) =>
	{
		let print;
		let color;
		let category;
		switch (diagnostic.category)
		{
			case tsModule.DiagnosticCategory.Message:
				print = context.info;
				color = white;
				category = "";
				break;
			case tsModule.DiagnosticCategory.Error:
				print = context.error;
				color = red;
				category = "error";
				break;
			case tsModule.DiagnosticCategory.Warning:
			default:
				print = context.warn;
				color = yellow;
				category = "warning";
				break;
		}

		const type = diagnostic.type + " ";

		if (pretty)
			return print.call(context, `${diagnostic.formatted}`);

		if (diagnostic.fileLine !== undefined)
			return print.call(context, `${diagnostic.fileLine}: ${type}${category} TS${diagnostic.code}: ${color(diagnostic.flatMessage)}`);

		return print.call(context, `${type}${category} TS${diagnostic.code}: ${color(diagnostic.flatMessage)}`);
	});
}
