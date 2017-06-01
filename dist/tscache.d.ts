import { IContext } from "./context";
import * as ts from "typescript";
export interface ICode {
    code: string | undefined;
    map: string | undefined;
    dts?: ts.OutputFile | undefined;
}
export interface IDiagnostics {
    flatMessage: string;
    fileLine?: string;
    category: ts.DiagnosticCategory;
    code: number;
    type: string;
}
export declare function convertDiagnostic(type: string, data: ts.Diagnostic[]): IDiagnostics[];
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
    constructor(host: ts.LanguageServiceHost, cache: string, options: ts.CompilerOptions, rollupConfig: any, rootFilenames: string[], context: IContext);
    clean(): void;
    setDependency(importee: string, importer: string): void;
    walkTree(cb: (id: string) => void | false): void;
    done(): void;
    getCompiled(id: string, snapshot: ts.IScriptSnapshot, transform: () => ICode | undefined): ICode | undefined;
    getSyntacticDiagnostics(id: string, snapshot: ts.IScriptSnapshot, check: () => ts.Diagnostic[]): IDiagnostics[];
    getSemanticDiagnostics(id: string, snapshot: ts.IScriptSnapshot, check: () => ts.Diagnostic[]): IDiagnostics[];
    private checkAmbientTypes();
    private getDiagnostics(type, cache, id, snapshot, check);
    private init();
    private markAsDirty(id, _snapshot);
    private isDirty(id, _snapshot, checkImports);
    private makeName(id, snapshot);
}
