export interface IRollupContext {
    warn(message: string): void;
    error(message: string): void;
}
export interface IContext {
    warn(message: string): void;
    error(message: string): void;
    info(message: string): void;
    debug(message: string): void;
}
export declare enum VerbosityLevel {
    Error = 0,
    Warning = 1,
    Info = 2,
    Debug = 3,
}
export declare class ConsoleContext implements IContext {
    private verbosity;
    private prefix;
    constructor(verbosity: VerbosityLevel, prefix?: string);
    warn(message: string): void;
    error(message: string): void;
    info(message: string): void;
    debug(message: string): void;
}
