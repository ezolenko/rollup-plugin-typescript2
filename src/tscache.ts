import * as tsTypes from "typescript";
import * as fs from "fs-extra";
import * as _ from "lodash";
import { Graph, alg } from "graphlib";
import objHash from "object-hash";
import { blue, yellow, green } from "colors/safe";

import { IContext } from "./context";
import { RollingCache } from "./rollingcache";
import { ICache } from "./icache";
import { tsModule } from "./tsproxy";
import { formatHost } from "./diagnostics-format-host";

export interface ICode
{
	code: string;
	map?: string;
	dts?: tsTypes.OutputFile;
	dtsmap?: tsTypes.OutputFile;
	references?: string[];
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

export function convertEmitOutput(output: tsTypes.EmitOutput, references?: string[]): ICode
{
	const out: ICode = { code: "", references };

	output.outputFiles.forEach((e) =>
	{
		if (e.name.endsWith(".d.ts"))
			out.dts = e;
		else if (e.name.endsWith(".d.ts.map"))
			out.dtsmap = e;
		else if (e.name.endsWith(".map"))
			out.map = e.text;
		else
			out.code = e.text;
	});

	return out;
}

export function getAllReferences(importer: string, snapshot: tsTypes.IScriptSnapshot | undefined, options: tsTypes.CompilerOptions)
{
	if (!snapshot)
		return [];

	const info = tsModule.preProcessFile(snapshot.getText(0, snapshot.getLength()), true, true);

	return _.compact(info.referencedFiles.concat(info.importedFiles).map((reference) =>
	{
		const resolved = tsModule.nodeModuleNameResolver(reference.fileName, importer, options, tsModule.sys);
		return resolved.resolvedModule?.resolvedFileName;
	}));
}

export function convertDiagnostic(type: string, data: tsTypes.Diagnostic[]): IDiagnostics[]
{
	return data.map((diagnostic) =>
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
	private cacheVersion = "9";
	private cachePrefix = "rpt2_";
	private dependencyTree: Graph;
	private ambientTypes!: ITypeSnapshot[];
	private ambientTypesDirty = false;
	private cacheDir!: string;
	private codeCache!: ICache<ICode | undefined>;
	private typesCache!: ICache<string>;
	private semanticDiagnosticsCache!: ICache<IDiagnostics[]>;
	private syntacticDiagnosticsCache!: ICache<IDiagnostics[]>;
	private hashOptions = { algorithm: "sha1", ignoreUnknown: false };

	constructor(private noCache: boolean, hashIgnoreUnknown: boolean, private host: tsTypes.LanguageServiceHost, private cacheRoot: string, private options: tsTypes.CompilerOptions, private rollupConfig: any, rootFilenames: string[], private context: IContext)
	{
		this.dependencyTree = new Graph({ directed: true });
		this.dependencyTree.setDefaultNodeLabel((_node: string) => ({ dirty: false }));

		if (noCache)
		{
			this.clean();
			return;
		}

		this.hashOptions.ignoreUnknown = hashIgnoreUnknown;
		this.cacheDir = `${this.cacheRoot}/${this.cachePrefix}${objHash(
			{
				version: this.cacheVersion,
				rootFilenames,
				options: this.options,
				rollupConfig: this.rollupConfig,
				tsVersion: tsModule.version,
			},
			this.hashOptions,
		)}`;

		this.init();

		const automaticTypes = tsModule.getAutomaticTypeDirectiveNames(options, tsModule.sys)
			.map((entry) => tsModule.resolveTypeReferenceDirective(entry, undefined, options, tsModule.sys))
			.filter((entry) => entry.resolvedTypeReferenceDirective?.resolvedFileName)
			.map((entry) => entry.resolvedTypeReferenceDirective!.resolvedFileName!);

		this.ambientTypes = rootFilenames.filter(file => file.endsWith(".d.ts"))
			.concat(automaticTypes)
			.map((id) => ({ id, snapshot: this.host.getScriptSnapshot(id) }));

		this.checkAmbientTypes();
	}

	private clean()
	{
		if (!fs.pathExistsSync(this.cacheRoot))
			return;

		const entries = fs.readdirSync(this.cacheRoot);
		entries.forEach((e) =>
		{
			const dir = `${this.cacheRoot}/${e}`;

			/* istanbul ignore if -- this is a safety check, but shouldn't happen when using a dedicated cache dir */
			if (!e.startsWith(this.cachePrefix))
			{
				this.context.debug(`skipping cleaning ${dir} as it does not have prefix ${this.cachePrefix}`);
				return;
			}

			/* istanbul ignore if -- this is a safety check, but should never happen in normal usage */
			if (!fs.statSync(dir).isDirectory)
			{
				this.context.debug(`skipping cleaning ${dir} as it is not a directory`);
				return;
			}

			this.context.info(blue(`cleaning cache: ${dir}`));
			fs.removeSync(`${dir}`);
		});
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
		if (alg.isAcyclic(this.dependencyTree))
		{
			alg.topsort(this.dependencyTree).forEach(id => cb(id));
			return;
		}

		this.context.info(yellow("import tree has cycles"));

		this.dependencyTree.nodes().forEach(id => cb(id));
	}

	public done()
	{
		if (this.noCache)
			return;

		this.context.info(blue("rolling caches"));
		this.codeCache.roll();
		this.semanticDiagnosticsCache.roll();
		this.syntacticDiagnosticsCache.roll();
		this.typesCache.roll();
	}

	public getCompiled(id: string, snapshot: tsTypes.IScriptSnapshot, transform: () => ICode | undefined): ICode | undefined
	{
		this.context.info(`${blue("transpiling")} '${id}'`);
		// the compiled JS code will not change if imports do, but the declarations can change based on imports' types changing, so only check imports when declarations are needed
		return this.getCached(this.codeCache, id, snapshot, Boolean(this.options.declaration), transform);
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
		const typeHashes = this.ambientTypes.filter((snapshot) => snapshot.snapshot !== undefined)
			.map((snapshot) =>
			{
				this.context.debug(`    ${snapshot.id}`);
				return this.createHash(snapshot.id, snapshot.snapshot!);
			});
		// types dirty if any d.ts changed, added or removed
		this.ambientTypesDirty = !this.typesCache.match(typeHashes);

		if (this.ambientTypesDirty)
			this.context.info(yellow("ambient types changed, redoing all semantic diagnostics"));

		typeHashes.forEach(this.typesCache.touch, this.typesCache);
	}

	private getDiagnostics(type: string, cache: ICache<IDiagnostics[]>, id: string, snapshot: tsTypes.IScriptSnapshot, check: () => tsTypes.Diagnostic[]): IDiagnostics[]
	{
		return this.getCached(cache, id, snapshot, true, () => convertDiagnostic(type, check()));
	}

	private getCached<CacheType>(cache: ICache<CacheType>, id: string, snapshot: tsTypes.IScriptSnapshot, checkImports: boolean, convert: () => CacheType): CacheType
	{
		if (this.noCache)
			return convert();

		const hash = this.createHash(id, snapshot);
		this.context.debug(`    cache: '${cache.path(hash)}'`);

		if (cache.exists(hash) && !this.isDirty(id, checkImports))
		{
			this.context.debug(green("    cache hit"));

			const data = cache.read(hash);
			if (data)
			{
				cache.write(hash, data);
				return data;
			}
			else
				this.context.warn(yellow("    cache broken, discarding"));
		}

		this.context.debug(yellow("    cache miss"));

		const convertedData = convert();
		cache.write(hash, convertedData);
		this.markAsDirty(id);
		return convertedData;
	}

	private init()
	{
		this.codeCache = new RollingCache<ICode>(`${this.cacheDir}/code`, true);
		this.typesCache = new RollingCache<string>(`${this.cacheDir}/types`, true);
		this.syntacticDiagnosticsCache = new RollingCache<IDiagnostics[]>(`${this.cacheDir}/syntacticDiagnostics`, true);
		this.semanticDiagnosticsCache = new RollingCache<IDiagnostics[]>(`${this.cacheDir}/semanticDiagnostics`, true);
	}

	private markAsDirty(id: string): void
	{
		this.dependencyTree.setNode(id, { dirty: true });
	}

	/** @returns true if node, any of its imports, or any ambient types changed */
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

		return Object.keys(dependencies).some(node =>
		{
			const dependency = dependencies[node];
			if (!node || dependency.distance === Infinity)
				return false;

			const l = this.dependencyTree.node(node) as INodeLabel | undefined;
			const dirty = l === undefined ? true : l.dirty;

			if (dirty)
				this.context.debug(`    import changed: ${node}`);

			return dirty;
		});
	}

	/** @returns an FS-safe hash string for use as a path to the cached content */
	private createHash(id: string, snapshot: tsTypes.IScriptSnapshot)
	{
		const data = snapshot.getText(0, snapshot.getLength());
		return objHash({ data, id }, this.hashOptions);
	}
}
