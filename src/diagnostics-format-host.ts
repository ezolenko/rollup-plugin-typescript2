import * as path from "path";
import * as tsTypes from "typescript";

export class FormatHost implements tsTypes.FormatDiagnosticsHost
{
	public getCurrentDirectory(): string
	{
		return tsTypes.sys.getCurrentDirectory();
	}

	public getCanonicalFileName(fileName: string): string
	{
		return path.normalize(fileName);
	}

	public getNewLine(): string
	{
		return tsTypes.sys.newLine;
	}
}

export const formatHost = new FormatHost();
