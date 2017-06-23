import { IRollupContext } from "./context";
import { ICode } from "./tscache";
export interface IOptions {
    include?: string;
    exclude?: string;
    check?: boolean;
    verbosity?: number;
    clean?: boolean;
    cacheRoot?: string;
    abortOnError?: boolean;
    rollupCommonJSResolveHack?: boolean;
    tsconfig?: string;
}
export declare function typescript(options?: IOptions): {
    options(config: any): void;
    resolveId(importee: string, importer: string): string | null;
    load(id: string): string | undefined;
    transform(this: IRollupContext, code: string, id: string): ICode | undefined;
    ongenerate(bundleOptions: any): void;
    onwrite(): void;
};
