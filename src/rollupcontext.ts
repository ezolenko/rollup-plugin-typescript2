import { IContext, IRollupContext, VerbosityLevel } from "./context";
import * as _ from "lodash";

export class RollupContext implements IContext
{
	private hasContext: boolean = true;

	constructor(private verbosity: VerbosityLevel, private bail: boolean, private context: IRollupContext, private prefix: string = "")
	{
		this.hasContext = _.isFunction(this.context.warn) && _.isFunction(this.context.error);
	}

	public warn(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Warning)
			return;

		if (this.hasContext)
			this.context.warn(`${this.prefix}${message}`);
		else
			console.log(`${this.prefix}${message}`);
	}

	public error(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Error)
			return;

		if (this.hasContext)
		{
			if (this.bail)
				this.context.error(`${this.prefix}${message}`);
			else
				this.context.warn(`${this.prefix}${message}`);
		}
		else
			console.log(`${this.prefix}${message}`);
	}

	public info(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Info)
			return;
		console.log(`${this.prefix}${message}`);
	}

	public debug(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Debug)
			return;
		console.log(`${this.prefix}${message}`);
	}
}
