import * as ts from "typescript";
import * as graph from "graphlib";
import * as hash from "object-hash";
import * as fs from "fs";
import * as _ from "lodash";
import * as mkdirp from "mkdirp";

export interface ICode
{
	code: string | undefined;
	map: string | undefined;
}

interface INodeLabel
{
	dirty: boolean;
	hash?: string;
}

export interface IDiagnostics
{
	flatMessage: string;
	fileLine?: string;
}

export class Cache
{
	private cacheVersion = "0";
	private dependencyTree: graph.Graph;
	private treeComplete: boolean = false;

	constructor(private cacheRoot: string, private options: ts.CompilerOptions, rootFilenames: string[])
	{
		this.cacheRoot = `${this.cacheRoot}/${hash.sha1({ version: this.cacheVersion, rootFilenames, options: this.options })}`;

		mkdirp.sync(this.cacheRoot);

		this.dependencyTree = new graph.Graph({ directed: true });
		this.dependencyTree.setDefaultNodeLabel((_node: string) => { return { dirty: false }; });
	}

	public walkTree(cb: (id: string) => void | false): void
	{
		const acyclic = graph.alg.isAcyclic(this.dependencyTree);

		if (acyclic)
		{
			_.each(graph.alg.topsort(this.dependencyTree), (id: string) => cb(id));
			return;
		}

		// console.log("cycles detected in dependency graph, not sorting");
		_.each(this.dependencyTree.nodes(), (id: string) => cb(id));
	}

	public setDependency(importee: string, importer: string): void
	{
		// console.log(importer, "->", importee);
		// importee -> importer
		this.dependencyTree.setEdge(importer, importee);
	}

	public lastDependencySet(): void
	{
		this.treeComplete = true;
	}

	public markAsDirty(id: string, _snapshot: ts.IScriptSnapshot): void
	{
		this.dependencyTree.setNode(id, { dirty: true });
	}

	// returns true if node or any of its imports changed
	public isDirty(id: string, _snapshot: ts.IScriptSnapshot, checkImports: boolean): boolean
	{
		let label = this.dependencyTree.node(id) as INodeLabel;

		if (!label)
			return false;

		if (!checkImports || label.dirty)
			return label.dirty;

		let dependencies = graph.alg.dijkstra(this.dependencyTree, id);

		return _.some(dependencies, (dependency, node) =>
		{
			if (!node || dependency.distance === Infinity)
				return false;

			let l = this.dependencyTree.node(node) as INodeLabel | undefined;
			let dirty = l === undefined ? true : l.dirty;

			if (dirty)
				console.log(`dirty: ${id} -> ${node}`);

			return dirty;
		});
	}

	public getCompiled(id: string, snapshot: ts.IScriptSnapshot, transform: () =>  ICode | undefined): ICode | undefined
	{
		let path = this.makePath(id, snapshot);

		if (!fs.existsSync(path) || this.isDirty(id, snapshot, false))
		{
			// console.log(`compile cache miss: ${id}`);
			let data = transform();
			this.setCache(path, id, snapshot, data);
			return data;
		}

		return JSON.parse(fs.readFileSync(path, "utf8")) as ICode;
	}

	public getDiagnostics(id: string, snapshot: ts.IScriptSnapshot, check: () => ts.Diagnostic[]): IDiagnostics[]
	{
		let path = `${this.makePath(id, snapshot)}.diagnostics`;

		if (!fs.existsSync(path) || this.isDirty(id, snapshot, true))
		{
			// console.log(`diagnostics cache miss: ${id}`);
			let data = this.convert(check());
			this.setCache(path, id, snapshot, data);
			return data;
		}

		return JSON.parse(fs.readFileSync(path, "utf8")) as IDiagnostics[];
	}

	private setCache(path: string, id: string, snapshot: ts.IScriptSnapshot, data: IDiagnostics[] | ICode | undefined): void
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

	private convert(data: ts.Diagnostic[]): IDiagnostics[]
	{
		return _.map(data, (diagnostic) =>
		{
			let entry: IDiagnostics =
			{
				flatMessage: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
			};

			if (diagnostic.file)
			{
				let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
				entry.fileLine = `${diagnostic.file.fileName} (${line + 1},${character + 1})`;
			}

			return entry;
		});
	}
}
