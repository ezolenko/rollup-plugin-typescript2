import { IContext, VerbosityLevel } from "./context";
import * as _ from "lodash";
import { PluginContext } from "rollup";

export class RollupContext implements IContext
{
	private hasContext: boolean = true;

	constructor(private options: { verbosity: VerbosityLevel, abortOnError: boolean, abortOnWarning: boolean, continueAfterFirstError: boolean}, private context: PluginContext, private prefix: string = "")
	{
		this.hasContext = _.isFunction(this.context.warn) && _.isFunction(this.context.error);
	}

	public warn(message: string | (() => string), lastMessage?: boolean): void
	{
		if (this.options.verbosity < VerbosityLevel.Warning)
			return;

		const text = _.isFunction(message) ? message() : message;

		if (this.hasContext)
		{
			if (this.options.abortOnWarning && (!this.options.continueAfterFirstError || lastMessage))
				this.context.error(`${text}`);
			else
				this.context.warn(`${text}`);
		}
		else
			console.log(`${this.prefix}${text}`);
	}

	public error(message: string | (() => string), lastMessage?: boolean): void
	{
		if (this.options.verbosity < VerbosityLevel.Error)
			return;

		const text = _.isFunction(message) ? message() : message;

		if (this.hasContext)
		{
			if (this.options.abortOnError && (!this.options.continueAfterFirstError || lastMessage))
				this.context.error(`${text}`);
			else
				this.context.warn(`${text}`);
		}
		else
			console.log(`${this.prefix}${text}`);
	}

	public info(message: string | (() => string)): void
	{
		if (this.options.verbosity < VerbosityLevel.Info)
			return;

		const text = _.isFunction(message) ? message() : message;

		console.log(`${this.prefix}${text}`);
	}

	public debug(message: string | (() => string)): void
	{
		if (this.options.verbosity < VerbosityLevel.Debug)
			return;

		const text = _.isFunction(message) ? message() : message;

		console.log(`${this.prefix}${text}`);
	}
}
