import { LanguageServiceHost as TypescriptLanguageServiceHost, IScriptSnapshot, ParsedCommandLine, CompilerOptions } from "typescript";
export declare class LanguageServiceHost implements TypescriptLanguageServiceHost {
    private parsedConfig;
    private cwd;
    private snapshots;
    private versions;
    constructor(parsedConfig: ParsedCommandLine);
    reset(): void;
    setSnapshot(fileName: string, data: string): IScriptSnapshot;
    getScriptSnapshot(fileName: string): IScriptSnapshot | undefined;
    getCurrentDirectory(): string;
    getScriptVersion(fileName: string): string;
    getScriptFileNames(): string[];
    getCompilationSettings(): CompilerOptions;
    getDefaultLibFileName(opts: CompilerOptions): string;
    useCaseSensitiveFileNames(): boolean;
    readDirectory(path: string, extensions?: string[], exclude?: string[], include?: string[]): string[];
    readFile(path: string, encoding?: string): string;
    fileExists(path: string): boolean;
    getTypeRootsVersion(): number;
    directoryExists(directoryName: string): boolean;
    getDirectories(directoryName: string): string[];
    private normalize(fileName);
}
