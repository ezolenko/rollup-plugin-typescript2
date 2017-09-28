import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
export interface IOptions {
    include: string;
    exclude: string;
    check: boolean;
    verbosity: number;
    clean: boolean;
    cacheRoot: string;
    abortOnError: boolean;
    rollupCommonJSResolveHack: boolean;
    tsconfig: string;
    useTsconfigDeclarationDir: boolean;
    typescript: typeof tsModule;
    tsconfigOverride: any;
    transformers: (service: tsTypes.LanguageService) => tsTypes.CustomTransformers;
}
