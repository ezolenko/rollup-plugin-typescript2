import * as tsTypes from "typescript";
import { normalizePath as normalize } from "@rollup/pluginutils";

import { tsModule } from "./tsproxy";
import { TransformerFactoryCreator } from "./ioptions";

export class LanguageServiceHost implements tsTypes.LanguageServiceHost
{
	private snapshots: { [fileName: string]: tsTypes.IScriptSnapshot } = {};
	private versions: { [fileName: string]: number } = {};
	private service?: tsTypes.LanguageService;
	private fileNames: Set<string>;

	constructor(private parsedConfig: tsTypes.ParsedCommandLine, private transformers: TransformerFactoryCreator[], private cwd: string)
	{
		this.fileNames = new Set(parsedConfig.fileNames);
	}

	public reset()
	{
		this.snapshots = {};
		this.versions = {};
	}

	public setLanguageService(service: tsTypes.LanguageService)
	{
		this.service = service;
	}

	public setSnapshot(fileName: string, source: string): tsTypes.IScriptSnapshot
	{
		fileName = normalize(fileName);

		const snapshot = tsModule.ScriptSnapshot.fromString(source);
		this.snapshots[fileName] = snapshot;
		this.versions[fileName] = (this.versions[fileName] || 0) + 1;
		this.fileNames.add(fileName);
		return snapshot;
	}

	public getScriptSnapshot(fileName: string): tsTypes.IScriptSnapshot | undefined
	{
		fileName = normalize(fileName);

		if (fileName in this.snapshots)
			return this.snapshots[fileName];

		const source = tsModule.sys.readFile(fileName);
		if (source)
			return this.setSnapshot(fileName, source);

		return undefined;
	}

	public getScriptFileNames = () => Array.from(this.fileNames.values());

	public getScriptVersion(fileName: string)
	{
		fileName = normalize(fileName);

		return (this.versions[fileName] || 0).toString();
	}

	public getCustomTransformers(): tsTypes.CustomTransformers | undefined
	{
		if (this.service === undefined || this.transformers === undefined || this.transformers.length === 0)
			return undefined;

		const transformer: tsTypes.CustomTransformers =
		{
			before: [],
			after: [],
			afterDeclarations: [],
		};

		for (const creator of this.transformers)
		{
			const factory = creator(this.service);
			if (factory.before)
				transformer.before = transformer.before!.concat(factory.before);
			if (factory.after)
				transformer.after = transformer.after!.concat(factory.after);
			if (factory.afterDeclarations)
				transformer.afterDeclarations = transformer.afterDeclarations!.concat(factory.afterDeclarations);
		}

		return transformer;
	}

	public getCompilationSettings = () => this.parsedConfig.options;
	public getTypeRootsVersion = () => 0;
	public getCurrentDirectory = () => this.cwd;

	public useCaseSensitiveFileNames = () => tsModule.sys.useCaseSensitiveFileNames;
	public getDefaultLibFileName = tsModule.getDefaultLibFilePath; // confusing naming: https://github.com/microsoft/TypeScript/issues/35318

	public readDirectory = tsModule.sys.readDirectory;
	public readFile = tsModule.sys.readFile;
	public fileExists = tsModule.sys.fileExists;
	public directoryExists = tsModule.sys.directoryExists;
	public getDirectories = tsModule.sys.getDirectories;
	public realpath = tsModule.sys.realpath!; // this exists in the default implementation: https://github.com/microsoft/TypeScript/blob/ab2523bbe0352d4486f67b73473d2143ad64d03d/src/compiler/sys.ts#L1288

	public trace = console.log;
}
