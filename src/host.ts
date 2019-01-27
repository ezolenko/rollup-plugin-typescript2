import * as tsModules from "typescript";
import { existsSync } from "fs";
import * as _ from "lodash";
import { normalize } from "./normalize";
import { TransformerFactoryCreator } from "./ioptions";

export class LanguageServiceHost implements tsModules.LanguageServiceHost
{
	private cwd = process.cwd();
	private snapshots: { [fileName: string]: tsModules.IScriptSnapshot } = {};
	private versions: { [fileName: string]: number } = {};
	private service?: tsModules.LanguageService;
	private fileNames: Set<string>;

	constructor(private parsedConfig: tsModules.ParsedCommandLine, private transformers: TransformerFactoryCreator[])
	{
		this.fileNames = new Set(parsedConfig.fileNames);
	}

	public reset()
	{
		this.snapshots = {};
		this.versions = {};
	}

	public setLanguageService(service: tsModules.LanguageService)
	{
		this.service = service;
	}

	public setSnapshot(fileName: string, data: string): tsModules.IScriptSnapshot
	{
		fileName = normalize(fileName);

		const snapshot = tsModules.ScriptSnapshot.fromString(data);
		this.snapshots[fileName] = snapshot;
		this.versions[fileName] = (this.versions[fileName] || 0) + 1;
		this.fileNames.add(fileName);
		return snapshot;
	}

	public getScriptSnapshot(fileName: string): tsModules.IScriptSnapshot | undefined
	{
		fileName = normalize(fileName);

		if (_.has(this.snapshots, fileName))
			return this.snapshots[fileName];

		if (existsSync(fileName))
		{
			this.snapshots[fileName] = tsModules.ScriptSnapshot.fromString(tsModules.sys.readFile(fileName)!);
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
		fileName = normalize(fileName);

		return (this.versions[fileName] || 0).toString();
	}

	public getScriptFileNames()
	{
		return Array.from(this.fileNames.values());
	}

	public getCompilationSettings(): tsModules.CompilerOptions
	{
		return this.parsedConfig.options;
	}

	public getDefaultLibFileName(opts: tsModules.CompilerOptions)
	{
		return tsModules.getDefaultLibFilePath(opts);
	}

	public useCaseSensitiveFileNames(): boolean
	{
		return tsModules.sys.useCaseSensitiveFileNames;
	}

	public readDirectory(path: string, extensions?: string[], exclude?: string[], include?: string[]): string[]
	{
		return tsModules.sys.readDirectory(path, extensions, exclude, include);
	}

	public readFile(path: string, encoding?: string): string | undefined
	{
		return tsModules.sys.readFile(path, encoding);
	}

	public fileExists(path: string): boolean
	{
		return tsModules.sys.fileExists(path);
	}

	public getTypeRootsVersion(): number
	{
		return 0;
	}

	public directoryExists(directoryName: string): boolean
	{
		return tsModules.sys.directoryExists(directoryName);
	}

	public getDirectories(directoryName: string): string[]
	{
		return tsModules.sys.getDirectories(directoryName);
	}

	public getCustomTransformers(): tsModules.CustomTransformers | undefined
	{
		if (this.service === undefined || this.transformers === undefined || this.transformers.length === 0)
			return undefined;

		const transformer: tsModules.CustomTransformers =
		{
			before: [],
			after: [],
		};

		for (const creator of this.transformers)
		{
			const factory = creator(this.service);
			if (factory.before)
				transformer.before = _.concat(transformer.before!, factory.before);
			if (factory.after)
				transformer.after = _.concat(transformer.after!, factory.after);
		}

		return transformer;
	}
}
