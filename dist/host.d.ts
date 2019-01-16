import * as tsTypes from "typescript";
import { TransformerFactoryCreator } from "./ioptions";
import { PluginContext } from "rollup";
export declare class LanguageServiceHost implements tsTypes.LanguageServiceHost {
    private parsedConfig;
    private transformers;
    private cwd;
    private snapshots;
    private versions;
    private service?;
    private fileNames;
    private context?;
    constructor(parsedConfig: tsTypes.ParsedCommandLine, transformers: TransformerFactoryCreator[]);
    reset(): void;
    setRollupContext(context?: PluginContext): void;
    setLanguageService(service: tsTypes.LanguageService): void;
    setSnapshot(fileName: string, data: string): tsTypes.IScriptSnapshot;
    getScriptSnapshot(fileName: string): tsTypes.IScriptSnapshot | undefined;
    getCurrentDirectory(): string;
    getScriptVersion(fileName: string): string;
    getScriptFileNames(): string[];
    getCompilationSettings(): tsTypes.CompilerOptions;
    getDefaultLibFileName(opts: tsTypes.CompilerOptions): string;
    useCaseSensitiveFileNames(): boolean;
    readDirectory(path: string, extensions?: string[], exclude?: string[], include?: string[]): string[];
    readFile(path: string, encoding?: string): string | undefined;
    fileExists(path: string): boolean;
    getTypeRootsVersion(): number;
    directoryExists(directoryName: string): boolean;
    getDirectories(directoryName: string): string[];
    getCustomTransformers(): tsTypes.CustomTransformers | undefined;
    resolveModuleNames(moduleNames: string[], containingFile: string, _reusedNames?: string[], _redirectedReference?: tsTypes.ResolvedProjectReference): Array<(tsTypes.ResolvedModule | undefined)>;
}
//# sourceMappingURL=host.d.ts.map