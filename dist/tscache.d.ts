import { IContext } from "./context";
import { Diagnostic, DiagnosticCategory, IScriptSnapshot, OutputFile, LanguageServiceHost, CompilerOptions } from "typescript";
export interface ICode {
    code: string | undefined;
    map: string | undefined;
    dts?: OutputFile | undefined;
}
export interface IDiagnostics {
    flatMessage: string;
    fileLine?: string;
    category: DiagnosticCategory;
    code: number;
    type: string;
}
export declare function convertDiagnostic(type: string, data: Diagnostic[]): IDiagnostics[];
export declare class TsCache {
    private host;
    private options;
    private rollupConfig;
    private context;
    private cacheVersion;
    private dependencyTree;
    private ambientTypes;
    private ambientTypesDirty;
    private cacheDir;
    private codeCache;
    private typesCache;
    private semanticDiagnosticsCache;
    private syntacticDiagnosticsCache;
    constructor(host: LanguageServiceHost, cache: string, options: CompilerOptions, rollupConfig: any, rootFilenames: string[], context: IContext);
    clean(): void;
    setDependency(importee: string, importer: string): void;
    walkTree(cb: (id: string) => void | false): void;
    done(): void;
    getCompiled(id: string, snapshot: IScriptSnapshot, transform: () => ICode | undefined): ICode | undefined;
    getSyntacticDiagnostics(id: string, snapshot: IScriptSnapshot, check: () => Diagnostic[]): IDiagnostics[];
    getSemanticDiagnostics(id: string, snapshot: IScriptSnapshot, check: () => Diagnostic[]): IDiagnostics[];
    private checkAmbientTypes();
    private getDiagnostics(type, cache, id, snapshot, check);
    private init();
    private markAsDirty(id);
    private isDirty(id, checkImports);
    private makeName(id, snapshot);
}
