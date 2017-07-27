import {LanguageServiceHost as TypescriptLanguageServiceHost, IScriptSnapshot, ParsedCommandLine, ScriptSnapshot, sys, CompilerOptions, getDefaultLibFilePath} from "typescript";
import {existsSync} from "fs";
import {has} from "lodash";

export class LanguageServiceHost implements TypescriptLanguageServiceHost
{
	private cwd = process.cwd();
	private snapshots: { [fileName: string]: IScriptSnapshot } = {};
	private versions: { [fileName: string]: number } = {};

	constructor(private parsedConfig: ParsedCommandLine)
	{
	}

	public reset()
	{
		this.snapshots = {};
		this.versions = {};
	}

	public setSnapshot(fileName: string, data: string): IScriptSnapshot
	{
		fileName = this.normalize(fileName);

		const snapshot = ScriptSnapshot.fromString(data);
		this.snapshots[fileName] = snapshot;
		this.versions[fileName] = (this.versions[fileName] || 0) + 1;
		return snapshot;
	}

	public getScriptSnapshot(fileName: string): IScriptSnapshot | undefined
	{
		fileName = this.normalize(fileName);

		if (has(this.snapshots, fileName))
			return this.snapshots[fileName];

		if (existsSync(fileName))
		{
			this.snapshots[fileName] = ScriptSnapshot.fromString(sys.readFile(fileName));
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

	public getCompilationSettings(): CompilerOptions
	{
		return this.parsedConfig.options;
	}

	public getDefaultLibFileName(opts: CompilerOptions)
	{
		return getDefaultLibFilePath(opts);
	}

	public useCaseSensitiveFileNames(): boolean
	{
		return sys.useCaseSensitiveFileNames;
	}

	public readDirectory(path: string, extensions?: string[], exclude?: string[], include?: string[]): string[]
	{
		return sys.readDirectory(path, extensions, exclude, include);
	}

	public readFile(path: string, encoding?: string): string
	{
		return sys.readFile(path, encoding);
	}

	public fileExists(path: string): boolean
	{
		return sys.fileExists(path);
	}

	public getTypeRootsVersion(): number
	{
		return 0;
	}

	public directoryExists(directoryName: string): boolean
	{
		return sys.directoryExists(directoryName);
	}

	public getDirectories(directoryName: string): string[]
	{
		return sys.getDirectories(directoryName);
	}

	private normalize(fileName: string)
	{
		return fileName.split("\\").join("/");
	}
}
