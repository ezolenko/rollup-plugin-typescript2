import * as path from "path";
import * as tsTypes from "typescript";

import { tsModule } from "./tsproxy";

export class FormatHost implements tsTypes.FormatDiagnosticsHost
{
	public getCurrentDirectory(): string
	{
		return tsModule.sys.getCurrentDirectory();
	}

	public getCanonicalFileName = path.normalize;
	public getNewLine = () => tsModule.sys.newLine;
}

export const formatHost = new FormatHost();
