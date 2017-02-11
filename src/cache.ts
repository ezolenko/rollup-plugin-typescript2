import { IContext } from "./context";
import * as ts from "typescript";
import * as graph from "graphlib";
import * as hash from "object-hash";
import * as _ from "lodash";
import { RollingCache } from "./rollingcache";
import * as fs from "fs-extra";

export interface ICode
{
	code: string | undefined;
	map: string | undefined;
}

interface INodeLabel
{
	dirty: boolean;
}

export interface IDiagnostics
{
	flatMessage: string;
	fileLine?: string;
}

interface ITypeSnapshot
{
	id: string;
	snapshot: ts.IScriptSnapshot | undefined;
}

export class Cache
{
	private cacheVersion = "1";
	private dependencyTree: graph.Graph;
	private ambientTypes: ITypeSnapshot[];
	private ambientTypesDirty = false;
	private cacheDir: string;
	private codeCache: RollingCache<ICode | undefined>;
	private typesCache: RollingCache<string>;
	private diagnosticsCache: RollingCache<IDiagnostics[]>;

	constructor(private host: ts.LanguageServiceHost, cache: string, private options: ts.CompilerOptions, rootFilenames: string[], private context: IContext)
	{
		this.cacheDir = `${cache}/${hash.sha1({ version: this.cacheVersion, rootFilenames, options: this.options })}`;

		this.codeCache = new RollingCache<ICode>(`${this.cacheDir}/code`, true);
		this.typesCache = new RollingCache<string>(`${this.cacheDir}/types`, false);
		this.diagnosticsCache = new RollingCache<IDiagnostics[]>(`${this.cacheDir}/diagnostics`, false);

		this.dependencyTree = new graph.Graph({ directed: true });
		this.dependencyTree.setDefaultNodeLabel((_node: string) => { return { dirty: false }; });

		this.ambientTypes = _
			.filter(rootFilenames, (file) => _.endsWith(file, ".d.ts"))
			.map((id) => { return { id, snapshot: this.host.getScriptSnapshot(id) }; });
	}

	public clean()
	{
		this.context.info(`cleaning cache: ${this.cacheDir}`);
		fs.emptyDirSync(this.cacheDir);
	}

	public walkTree(cb: (id: string) => void | false): void
	{
		const acyclic = graph.alg.isAcyclic(this.dependencyTree);

		if (acyclic)
		{
			_.each(graph.alg.topsort(this.dependencyTree), (id: string) => cb(id));
			return;
		}

		this.context.info("import tree has cycles");

		_.each(this.dependencyTree.nodes(), (id: string) => cb(id));
	}

	public setDependency(importee: string, importer: string): void
	{
		// importee -> importer
		this.context.debug(`${importee} -> ${importer}`);
		this.dependencyTree.setEdge(importer, importee);
	}

	public compileDone(): void
	{
		let typeNames = _
			.filter(this.ambientTypes, (snaphot) => snaphot.snapshot !== undefined)
			.map((snaphot) => this.makeName(snaphot.id, snaphot.snapshot!));

		// types dirty if any d.ts changed, added or removed
		this.ambientTypesDirty = !this.typesCache.match(typeNames);

		if (this.ambientTypesDirty)
			this.context.info("ambient types changed, redoing all diagnostics");

		_.each(typeNames, (name) => this.typesCache.touch(name));
	}

	public diagnosticsDone()
	{
		this.codeCache.roll();
		this.diagnosticsCache.roll();
		this.typesCache.roll();
	}

	public getCompiled(id: string, snapshot: ts.IScriptSnapshot, transform: () =>  ICode | undefined): ICode | undefined
	{
		let name = this.makeName(id, snapshot);

		if (!this.codeCache.exists(name) || this.isDirty(id, snapshot, false))
		{
			this.context.debug(`fresh transpile for: ${id}`);

			let data = transform();
			this.codeCache.write(name, data);
			this.markAsDirty(id, snapshot);
			return data;
		}

		this.context.debug(`old transpile for: ${id}`);

		let data = this.codeCache.read(name);
		this.codeCache.write(name, data);
		return data;
	}

	public getDiagnostics(id: string, snapshot: ts.IScriptSnapshot, check: () => ts.Diagnostic[]): IDiagnostics[]
	{
		let name = this.makeName(id, snapshot);

		if (!this.diagnosticsCache.exists(name) || this.isDirty(id, snapshot, true))
		{
			this.context.debug(`fresh diagnostics for: ${id}`);

			let data = this.convert(check());
			this.diagnosticsCache.write(name, data);
			this.markAsDirty(id, snapshot);
			return data;
		}

		this.context.debug(`old diagnostics for: ${id}`);

		let data = this.diagnosticsCache.read(name);
		this.diagnosticsCache.write(name, data);
		return data;
	}

	private markAsDirty(id: string, _snapshot: ts.IScriptSnapshot): void
	{
		this.context.debug(`changed: ${id}`);
		this.dependencyTree.setNode(id, { dirty: true });
	}

	// returns true if node or any of its imports or any of global types changed
	private isDirty(id: string, _snapshot: ts.IScriptSnapshot, checkImports: boolean): boolean
	{
		let label = this.dependencyTree.node(id) as INodeLabel;

		if (!label)
			return false;

		if (!checkImports || label.dirty)
			return label.dirty;

		if (this.ambientTypesDirty)
			return true;

		let dependencies = graph.alg.dijkstra(this.dependencyTree, id);

		return _.some(dependencies, (dependency, node) =>
		{
			if (!node || dependency.distance === Infinity)
				return false;

			let l = this.dependencyTree.node(node) as INodeLabel | undefined;
			let dirty = l === undefined ? true : l.dirty;

			if (dirty)
				this.context.debug(`import changed: ${id} -> ${node}`);

			return dirty;
		});
	}

	private makeName(id: string, snapshot: ts.IScriptSnapshot)
	{
		let data = snapshot.getText(0, snapshot.getLength());
		return hash.sha1({ data, id });
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
