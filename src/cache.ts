import * as ts from "typescript";
import * as graph from "graphlib";
import * as hash from "object-hash";
import * as fs from "fs";

interface ICode
{
	code: string;
	map: string;
}

interface INodeLabel
{
	dirty: boolean;
	hash?: string;
}

export class Cache
{
	private dependencyTree: graph.Graph;
	private treeComplete: boolean = false;

	constructor(private cacheRoot: string, private options: ts.CompilerOptions, rootFilenames: string[])
	{
		this.cacheRoot = `${this.cacheRoot}/${hash.sha1({ rootFilenames, options: this.options })}`;
		fs.mkdirSync(this.cacheRoot);

		let dependencyTreeFile = `${this.cacheRoot}/tree`;
		if (fs.existsSync(dependencyTreeFile))
		{
			let data = fs.readFileSync(`${this.cacheRoot}/tree`, "utf8");

			this.dependencyTree = graph.json.read(JSON.parse(data));
		}
		else
			this.dependencyTree = new graph.Graph({ directed: true });

		this.dependencyTree.setDefaultNodeLabel((_node: string) => { return { dirty: false }; });
	}

	public setDependency(importee: string, importer: string): void
	{
		this.dependencyTree.setEdge(importer, importee);
	}

	public lastDependencySet()
	{
		this.treeComplete = true;
	}

	public markAsDirty(fileName: string, _snapshot: ts.IScriptSnapshot)
	{
		this.dependencyTree.setNode(fileName, { dirty: true });
	}

	public isDirty(fileName: string, _snapshot: ts.IScriptSnapshot): boolean
	{
		let label = this.dependencyTree.node(fileName) as INodeLabel;

		// TODO: also if any dependencies are dirty

		return label.dirty;
	}

	public getCompiled(fileName: string, snapshot: ts.IScriptSnapshot, transform: () =>  ICode | undefined): ICode | undefined
	{
		let path = this.makePath(fileName, snapshot);

		if (!fs.existsSync(path) || this.isDirty(fileName, snapshot))
		{
			let data = transform();
			this.setCache(path, fileName, snapshot, data);
			return data;
		}

		return JSON.parse(fs.readFileSync(path, "utf8")) as ICode;
	}

	public getDiagnostics(fileName: string, snapshot: ts.IScriptSnapshot, check: () => ts.Diagnostic[]): ts.Diagnostic[]
	{
		let path = `${this.makePath(fileName, snapshot)}.diagnostics`;

		if (!fs.existsSync(path) || this.isDirty(fileName, snapshot))
		{
			let data = check();
			this.setCache(path, fileName, snapshot, data);
			return data;
		}

		return JSON.parse(fs.readFileSync(path, "utf8")) as ts.Diagnostic[];
	}

	private setCache(path: string, fileName: string, snapshot: ts.IScriptSnapshot, data: ts.Diagnostic[] | ICode | undefined): void
	{
		if (data === undefined)
			return;

		fs.writeFileSync(path, JSON.stringify(data));

		this.markAsDirty(fileName, snapshot);
	}

	private makePath(fileName: string, snapshot: ts.IScriptSnapshot): string
	{
		let data = snapshot.getText(0, snapshot.getLength());
		return `${this.cacheRoot}/${hash.sha1({ data, fileName })}`;
	}
}
