import { IContext, IRollupContext, VerbosityLevel } from "./context";

export class RollupContext implements IContext
{
	constructor(private verbosity: VerbosityLevel, private bail: boolean, private context: IRollupContext, private prefix: string = "")
	{
	}

	public warn(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Warning)
			return;
		this.context.warn(`${this.prefix}${message}`);
	}

	public error(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Error)
			return;

		if (this.bail)
			this.context.error(`${this.prefix}${message}`);
		else
			this.context.warn(`${this.prefix}${message}`);
	}

	public info(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Info)
			return;
		this.context.warn(`${this.prefix}${message}`);
	}

	public debug(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Debug)
			return;
		this.context.warn(`${this.prefix}${message}`);
	}
}
