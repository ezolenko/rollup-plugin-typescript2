import * as _ from "lodash";
import { PluginContext } from "rollup";

import { IContext, VerbosityLevel } from "./context";

export class RollupContext implements IContext
{
	constructor(private verbosity: VerbosityLevel, private bail: boolean, private context: PluginContext, private prefix: string = "")
	{
	}

	public warn(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Warning)
			return;

		const text = _.isFunction(message) ? message() : message;
		this.context.warn(`${text}`);
	}

	public error(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Error)
			return;

		const text = _.isFunction(message) ? message() : message;

		if (this.bail)
			this.context.error(`${text}`);
		else
			this.context.warn(`${text}`);
	}

	public info(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Info)
			return;

		const text = _.isFunction(message) ? message() : message;
		console.log(`${this.prefix}${text}`);
	}

	public debug(message: string | (() => string)): void
	{
		if (this.verbosity < VerbosityLevel.Debug)
			return;

		const text = _.isFunction(message) ? message() : message;
		console.log(`${this.prefix}${text}`);
	}
}
