import { PluginContext } from "rollup";
export interface IContext {
    warn(message: string | (() => string)): void;
    error(message: string | (() => string)): void;
    info(message: string | (() => string)): void;
    debug(message: string | (() => string)): void;
}
export declare enum VerbosityLevel {
    Error = 0,
    Warning = 1,
    Info = 2,
    Debug = 3
}
/** mainly to be used in options hook, but can be used in other hooks too */
export declare class ConsoleContext implements IContext {
    private verbosity;
    private prefix;
    constructor(verbosity: VerbosityLevel, prefix?: string);
    warn(message: string | (() => string)): void;
    error(message: string | (() => string)): void;
    info(message: string | (() => string)): void;
    debug(message: string | (() => string)): void;
}
/** cannot be used in options hook (which does not have this.warn and this.error), but can be in other hooks */
export declare class RollupContext implements IContext {
    private verbosity;
    private bail;
    private context;
    private prefix;
    constructor(verbosity: VerbosityLevel, bail: boolean, context: PluginContext, prefix?: string);
    warn(message: string | (() => string)): void;
    error(message: string | (() => string)): void;
    info(message: string | (() => string)): void;
    debug(message: string | (() => string)): void;
}
//# sourceMappingURL=context.d.ts.map