import { IContext, VerbosityLevel } from "./context";
import { PluginContext } from "rollup";
export declare class RollupContext implements IContext {
    private options;
    private context;
    private prefix;
    private hasContext;
    constructor(options: {
        verbosity: VerbosityLevel;
        abortOnError: boolean;
        abortOnWarning: boolean;
        continueAfterFirstError: boolean;
    }, context: PluginContext, prefix?: string);
    warn(message: string | (() => string), lastMessage?: boolean): void;
    error(message: string | (() => string), lastMessage?: boolean): void;
    info(message: string | (() => string)): void;
    debug(message: string | (() => string)): void;
}
//# sourceMappingURL=rollupcontext.d.ts.map