import { PluginContext } from "rollup";

export enum VerbosityLevel
{
	Error = 0,
	Warning,
	Info,
	Debug,
}

function getText (message: string | (() => string)): string {
	return typeof message === "string" ? message : message();
}

/** cannot be used in options hook (which does not have this.warn and this.error), but can be in other hooks */
export class RollupContext
{
	constructor(private verbosity: VerbosityLevel, private bail: boolean, private context: PluginContext, private prefix: string = "")
	{
	}

	public warn(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Warning)
			return;
		this.context.warn(`${getText(message)}`);
	}

	public error(message: string | (() => string)): void | never
	{
		if (this.verbosity < VerbosityLevel.Error)
			return;

		if (this.bail)
			this.context.error(`${getText(message)}`);
		else
			this.context.warn(`${getText(message)}`);
	}

	public info(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Info)
			return;
		console.log(`${this.prefix}${getText(message)}`);
	}

	public debug(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Debug)
			return;
		console.log(`${this.prefix}${getText(message)}`);
	}
}
