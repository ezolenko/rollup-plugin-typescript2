import { IContext } from "./context";
import { IOptions } from "./ioptions";
export declare function parseTsConfig(context: IContext, pluginOptions: IOptions, buildStatus: {
    error: boolean;
    warning: boolean;
}): {
    parsedTsConfig: import("typescript").ParsedCommandLine;
    fileName: string | undefined;
};
//# sourceMappingURL=parse-tsconfig.d.ts.map