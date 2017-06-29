import * as fs from "fs-extra";
import * as ts from "typescript";
import * as _ from "lodash";

export class LanguageServiceHost implements ts.LanguageServiceHost
{
	private cwd = process.cwd();
	private snapshots: { [fileName: string]: ts.IScriptSnapshot } = {};
	private versions: { [fileName: string]: number } = {};

	constructor(private parsedConfig: ts.ParsedCommandLine)
	{
	}

	public reset()
	{
		this.snapshots = {};
		this.versions = {};
	}

	public setSnapshot(fileName: string, data: string): ts.IScriptSnapshot
	{
		fileName = this.normalize(fileName);

		const snapshot = ts.ScriptSnapshot.fromString(data);
		this.snapshots[fileName] = snapshot;
		this.versions[fileName] = (this.versions[fileName] || 0) + 1;
		return snapshot;
	}

	public getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined
	{
		fileName = this.normalize(fileName);

		if (_.has(this.snapshots, fileName))
			return this.snapshots[fileName];

		if (fs.existsSync(fileName))
		{
			this.snapshots[fileName] = ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName));
			this.versions[fileName] = (this.versions[fileName] || 0) + 1;
			return this.snapshots[fileName];
		}

		return undefined;
	}

	public getCurrentDirectory()
	{
		return this.cwd;
	}

	public getScriptVersion(fileName: string)
	{
		fileName = this.normalize(fileName);

		return (this.versions[fileName] || 0).toString();
	}

	public getScriptFileNames()
	{
		return this.parsedConfig.fileNames;
	}

	public getCompilationSettings(): ts.CompilerOptions
	{
		return this.parsedConfig.options;
	}

	public getDefaultLibFileName(opts: ts.CompilerOptions)
	{
		return ts.getDefaultLibFilePath(opts);
	}

	public useCaseSensitiveFileNames(): boolean
	{
		return ts.sys.useCaseSensitiveFileNames;
	}

	public readDirectory(path: string, extensions?: string[], exclude?: string[], include?: string[]): string[]
	{
		return ts.sys.readDirectory(path, extensions, exclude, include);
	}

	public readFile(path: string, encoding?: string): string
	{
		return ts.sys.readFile(path, encoding);
	}

	public fileExists(path: string): boolean
	{
		return ts.sys.fileExists(path);
	}

	public getTypeRootsVersion(): number
	{
		return 0;
	}

	// public resolveModuleNames(moduleNames: string[], containingFile: string): ts.ResolvedModule[]

	// public resolveTypeReferenceDirectives?(typeDirectiveNames: string[], containingFile: string): ResolvedTypeReferenceDirective[]

	public directoryExists(directoryName: string): boolean
	{
		return ts.sys.directoryExists(directoryName);
	}

	public getDirectories(directoryName: string): string[]
	{
		return ts.sys.getDirectories(directoryName);
	}

	private normalize(fileName: string)
	{
		return fileName.split("\\").join("/");
	}
}
