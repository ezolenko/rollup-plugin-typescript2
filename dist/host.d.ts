import * as ts from "typescript";
export declare class LanguageServiceHost implements ts.LanguageServiceHost {
    private parsedConfig;
    private cwd;
    private snapshots;
    private versions;
    constructor(parsedConfig: ts.ParsedCommandLine);
    reset(): void;
    setSnapshot(fileName: string, data: string): ts.IScriptSnapshot;
    getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined;
    getCurrentDirectory(): string;
    getScriptVersion(fileName: string): string;
    getScriptFileNames(): string[];
    getCompilationSettings(): ts.CompilerOptions;
    getDefaultLibFileName(opts: ts.CompilerOptions): string;
    private normalize(fileName);
}
