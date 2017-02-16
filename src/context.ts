
export interface IRollupContext
{
	warn(message: string): void;
	error(message: string): void;
}

export interface IContext
{
	warn(message: string): void;
	error(message: string): void;
	info(message: string): void;
	debug(message: string): void;
}

export enum VerbosityLevel
{
	Error = 0,
	Warning,
	Info,
	Debug,
}

export class ConsoleContext implements IContext
{
	constructor(private verbosity: VerbosityLevel, private prefix: string = "")
	{
	}

	public warn(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Warning)
			return;
		console.log(`${this.prefix}${message}`);
	}

	public error(message: string): void
	{
		if (this.verbosity < VerbosityLevel.Error)
			return;
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
