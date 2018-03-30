import { IContext } from "./context";
import { Graph, alg } from "graphlib";
import { sha1 } from "object-hash";
import { RollingCache } from "./rollingcache";
import { ICache } from "./icache";
import * as _ from "lodash";
import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";
import { blue, yellow, green } from "colors/safe";
import { emptyDirSync, pathExistsSync } from "fs-extra";
import { formatHost } from "./diagnostics-format-host";
import { NoCache } from "./nocache";

export interface ICode
{
	code: string | undefined;
	map: string | undefined;
	dts?: tsTypes.OutputFile | undefined;
}

export interface IRollupCode
{
	code: string | undefined;
	map: { mappings: string };
}

interface INodeLabel
{
	dirty: boolean;
}

export interface IDiagnostics
{
	flatMessage: string;
	formatted: string;
	fileLine?: string;
	category: tsTypes.DiagnosticCategory;
	code: number;
	type: string;
}

interface ITypeSnapshot
{
	id: string;
	snapshot: tsTypes.IScriptSnapshot | undefined;
}

export function convertDiagnostic(type: string, data: tsTypes.Diagnostic[]): IDiagnostics[]
{
	return _.map(data, (diagnostic) =>
	{
		const entry: IDiagnostics =
			{
				flatMessage: tsModule.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
				formatted: tsModule.formatDiagnosticsWithColorAndContext(data, formatHost),
				category: diagnostic.category,
				code: diagnostic.code,
				type,
			};

		if (diagnostic.file && diagnostic.start !== undefined)
		{
			const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
			entry.fileLine = `${diagnostic.file.fileName}(${line + 1},${character + 1})`;
		}

		return entry;
	});
}

export class TsCache
{
	private cacheVersion = "7";
	private dependencyTree: Graph;
	private ambientTypes: ITypeSnapshot[];
	private ambientTypesDirty = false;
	private cacheDir: string;
	private codeCache!: ICache<ICode | undefined>;
	private typesCache!: ICache<string>;
	private semanticDiagnosticsCache!: ICache<IDiagnostics[]>;
	private syntacticDiagnosticsCache!: ICache<IDiagnostics[]>;

	constructor(private noCache: boolean, private host: tsTypes.LanguageServiceHost, cache: string, private options: tsTypes.CompilerOptions, private rollupConfig: any, rootFilenames: string[], private context: IContext)
	{
		this.cacheDir = `${cache}/${sha1({
			version: this.cacheVersion,
			rootFilenames,
			options: this.options,
			rollupConfig: this.rollupConfig,
			tsVersion: tsModule.version,
		})}`;

		this.dependencyTree = new Graph({ directed: true });
		this.dependencyTree.setDefaultNodeLabel((_node: string) => ({ dirty: false }));

		const automaticTypes = _.map(tsModule.getAutomaticTypeDirectiveNames(options, tsModule.sys), (entry) => tsModule.resolveTypeReferenceDirective(entry, undefined, options, tsModule.sys))
			.filter((entry) => entry.resolvedTypeReferenceDirective && entry.resolvedTypeReferenceDirective.resolvedFileName)
			.map((entry) => entry.resolvedTypeReferenceDirective!.resolvedFileName!);

		this.ambientTypes = _.filter(rootFilenames, (file) => _.endsWith(file, ".d.ts"))
			.concat(automaticTypes)
			.map((id) => ({ id, snapshot: this.host.getScriptSnapshot(id) }));

		this.init();

		this.checkAmbientTypes();
	}

	public clean()
	{
		if (pathExistsSync(this.cacheDir))
		{
			this.context.info(blue(`cleaning cache: ${this.cacheDir}`));
			emptyDirSync(this.cacheDir);
		}

		this.init();
	}

	public setDependency(importee: string, importer: string): void
	{
		// importee -> importer
		this.context.debug(`${blue("dependency")} '${importee}'`);
		this.context.debug(`    imported by '${importer}'`);
		this.dependencyTree.setEdge(importer, importee);
	}

	public walkTree(cb: (id: string) => void | false): void
	{
		const acyclic = alg.isAcyclic(this.dependencyTree);

		if (acyclic)
		{
			_.each(alg.topsort(this.dependencyTree), (id: string) => cb(id));
			return;
		}

		this.context.info(yellow("import tree has cycles"));

		_.each(this.dependencyTree.nodes(), (id: string) => cb(id));
	}

	public done()
	{
		this.context.info(blue("rolling caches"));
		this.codeCache.roll();
		this.semanticDiagnosticsCache.roll();
		this.syntacticDiagnosticsCache.roll();
		this.typesCache.roll();
	}

	public getCompiled(id: string, snapshot: tsTypes.IScriptSnapshot, transform: () => ICode | undefined): ICode | undefined
	{
		const name = this.makeName(id, snapshot);

		this.context.info(`${blue("transpiling")} '${id}'`);
		this.context.debug(`    cache: '${this.codeCache.path(name)}'`);

		if (this.codeCache.exists(name) && !this.isDirty(id, false))
		{
			this.context.debug(green("    cache hit"));
			const data = this.codeCache.read(name);
			if (data)
			{
				this.codeCache.write(name, data);
				return data;
			}
			else
				this.context.warn(yellow("    cache broken, discarding"));
		}

		this.context.debug(yellow("    cache miss"));

		const transformedData = transform();
		this.codeCache.write(name, transformedData);
		this.markAsDirty(id);
		return transformedData;
	}

	public getSyntacticDiagnostics(id: string, snapshot: tsTypes.IScriptSnapshot, check: () => tsTypes.Diagnostic[]): IDiagnostics[]
	{
		return this.getDiagnostics("syntax", this.syntacticDiagnosticsCache, id, snapshot, check);
	}

	public getSemanticDiagnostics(id: string, snapshot: tsTypes.IScriptSnapshot, check: () => tsTypes.Diagnostic[]): IDiagnostics[]
	{
		return this.getDiagnostics("semantic", this.semanticDiagnosticsCache, id, snapshot, check);
	}

	private checkAmbientTypes(): void
	{
		this.context.debug(blue("Ambient types:"));
		const typeNames = _.filter(this.ambientTypes, (snapshot) => snapshot.snapshot !== undefined)
			.map((snapshot) =>
			{
				this.context.debug(`    ${snapshot.id}`);
				return this.makeName(snapshot.id, snapshot.snapshot!);
			});
		// types dirty if any d.ts changed, added or removed
		this.ambientTypesDirty = !this.typesCache.match(typeNames);

		if (this.ambientTypesDirty)
			this.context.info(yellow("ambient types changed, redoing all semantic diagnostics"));

		_.each(typeNames, (name) => this.typesCache.touch(name));
	}

	private getDiagnostics(type: string, cache: ICache<IDiagnostics[]>, id: string, snapshot: tsTypes.IScriptSnapshot, check: () => tsTypes.Diagnostic[]): IDiagnostics[]
	{
		const name = this.makeName(id, snapshot);

		this.context.debug(`    cache: '${cache.path(name)}'`);

		if (cache.exists(name) && !this.isDirty(id, true))
		{
			this.context.debug(green("    cache hit"));

			const data = cache.read(name);
			if (data)
			{
				cache.write(name, data);
				return data;
			}
			else
				this.context.warn(yellow("    cache broken, discarding"));
		}

		this.context.debug(yellow("    cache miss"));

		const convertedData = convertDiagnostic(type, check());
		cache.write(name, convertedData);
		this.markAsDirty(id);
		return convertedData;
	}

	private init()
	{
		if (this.noCache)
		{
			this.codeCache = new NoCache<ICode>();
			this.typesCache = new NoCache<string>();
			this.syntacticDiagnosticsCache = new NoCache<IDiagnostics[]>();
			this.semanticDiagnosticsCache = new NoCache<IDiagnostics[]>();
		}
		else
		{
			this.codeCache = new RollingCache<ICode>(`${this.cacheDir}/code`, true);
			this.typesCache = new RollingCache<string>(`${this.cacheDir}/types`, true);
			this.syntacticDiagnosticsCache = new RollingCache<IDiagnostics[]>(`${this.cacheDir}/syntacticDiagnostics`, true);
			this.semanticDiagnosticsCache = new RollingCache<IDiagnostics[]>(`${this.cacheDir}/semanticDiagnostics`, true);
		}
	}

	private markAsDirty(id: string): void
	{
		this.dependencyTree.setNode(id, { dirty: true });
	}

	// returns true if node or any of its imports or any of global types changed
	private isDirty(id: string, checkImports: boolean): boolean
	{
		const label = this.dependencyTree.node(id) as INodeLabel;

		if (!label)
			return false;

		if (!checkImports || label.dirty)
			return label.dirty;

		if (this.ambientTypesDirty)
			return true;

		const dependencies = alg.dijkstra(this.dependencyTree, id);

		return _.some(dependencies, (dependency, node) =>
		{
			if (!node || dependency.distance === Infinity)
				return false;

			const l = this.dependencyTree.node(node) as INodeLabel | undefined;
			const dirty = l === undefined ? true : l.dirty;

			if (dirty)
				this.context.debug(`    import changed: ${node}`);

			return dirty;
		});
	}

	private makeName(id: string, snapshot: tsTypes.IScriptSnapshot)
	{
		const data = snapshot.getText(0, snapshot.getLength());
		return sha1({ data, id });
	}
}
