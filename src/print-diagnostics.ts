import { red, white, yellow } from "colors/safe";

import { tsModule } from "./tsproxy";
import { RollupContext } from "./context";
import { IDiagnostics } from "./tscache";

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
