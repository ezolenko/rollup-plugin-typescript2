import { tsModule } from "./tsproxy";
import { red, white, yellow } from "colors/safe";
import { each } from "lodash";
import { IContext } from "./context";
import { IDiagnostics } from "./tscache";

export function printDiagnostics(context: IContext, diagnostics: IDiagnostics[]): void
{
	each(diagnostics, (diagnostic) =>
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

		if (diagnostic.fileLine)
			print.call(context, [`${diagnostic.fileLine}: ${type}${category} TS${diagnostic.code} ${color(diagnostic.flatMessage)}`]);
		else
			print.call(context, [`${type}${category} TS${diagnostic.code} ${color(diagnostic.flatMessage)}`]);
	});
}
