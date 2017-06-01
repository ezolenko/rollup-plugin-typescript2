import { IContext, IRollupContext, VerbosityLevel } from "./context";
export declare class RollupContext implements IContext {
    private verbosity;
    private bail;
    private context;
    private prefix;
    private hasContext;
    constructor(verbosity: VerbosityLevel, bail: boolean, context: IRollupContext, prefix?: string);
    warn(message: string): void;
    error(message: string): void;
    info(message: string): void;
    debug(message: string): void;
}
