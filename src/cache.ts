import * as ts from "typescript";
import * as graph from "graphlib";
import * as hash from "object-hash";
import * as fs from "fs";
import * as _ from "lodash";

export interface ICode
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

	public walkTree(cb: (id: string) => void | false)
	{
		_.each(graph.alg.topsort(this.dependencyTree), (id: string) => cb(id));
	}

	public setDependency(importee: string, importer: string): void
	{
		// importer -> importee
		this.dependencyTree.setEdge(importer, importee);
	}

	public lastDependencySet()
	{
		this.treeComplete = true;
	}

	public markAsDirty(id: string, _snapshot: ts.IScriptSnapshot)
	{
		this.dependencyTree.setNode(id, { dirty: true });
	}

	// returns true if node or any of its imports changed
	public isDirty(id: string, _snapshot: ts.IScriptSnapshot, checkImports: boolean): boolean
	{
		let label = this.dependencyTree.node(id) as INodeLabel;

		if (checkImports || label.dirty)
			return label.dirty;

		let dependencies = graph.alg.dijkstra(this.dependencyTree, id);

		return _.some(_.keys(dependencies), (dependencyId: string) => (this.dependencyTree.node(dependencyId) as INodeLabel).dirty);
	}

	public getCompiled(id: string, snapshot: ts.IScriptSnapshot, transform: () =>  ICode | undefined): ICode | undefined
	{
		let path = this.makePath(id, snapshot);

		if (!fs.existsSync(path) || this.isDirty(id, snapshot, false))
		{
			let data = transform();
			this.setCache(path, id, snapshot, data);
			return data;
		}

		return JSON.parse(fs.readFileSync(path, "utf8")) as ICode;
	}

	public getDiagnostics(id: string, snapshot: ts.IScriptSnapshot, check: () => ts.Diagnostic[]): ts.Diagnostic[]
	{
		let path = `${this.makePath(id, snapshot)}.diagnostics`;

		if (!fs.existsSync(path) || this.isDirty(id, snapshot, true))
		{
			let data = check();
			this.setCache(path, id, snapshot, data);
			return data;
		}

		return JSON.parse(fs.readFileSync(path, "utf8")) as ts.Diagnostic[];
	}

	private setCache(path: string, id: string, snapshot: ts.IScriptSnapshot, data: ts.Diagnostic[] | ICode | undefined): void
	{
		if (data === undefined)
			return;

		fs.writeFileSync(path, JSON.stringify(data));

		this.markAsDirty(id, snapshot);
	}

	private makePath(id: string, snapshot: ts.IScriptSnapshot): string
	{
		let data = snapshot.getText(0, snapshot.getLength());
		return `${this.cacheRoot}/${hash.sha1({ data, id })}`;
	}
}
