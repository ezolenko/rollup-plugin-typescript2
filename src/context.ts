import { PluginContext } from "rollup";

export interface IContext
{
	warn(message: string | (() => string)): void;
	error(message: string | (() => string)): void;
	info(message: string | (() => string)): void;
	debug(message: string | (() => string)): void;
}

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

/* tslint:disable:max-classes-per-file -- generally a good rule to follow, but these two classes could basically be one */

/** mainly to be used in options hook, but can be used in other hooks too */
export class ConsoleContext implements IContext
{
	constructor(private verbosity: VerbosityLevel, private prefix: string = "")
	{
	}

	public warn(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Warning)
			return;
		console.log(`${this.prefix}${getText(message)}`);
	}

	public error(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Error)
			return;
		console.log(`${this.prefix}${getText(message)}`);
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

/** cannot be used in options hook (which does not have this.warn and this.error), but can be in other hooks */
export class RollupContext implements IContext
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

	public error(message: string | (() => string)): void
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
