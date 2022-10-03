import { relative, dirname, normalize as pathNormalize, resolve } from "path";
import * as tsTypes from "typescript";
import { PluginImpl, InputOptions, TransformResult, SourceMap, Plugin } from "rollup";
import { normalizePath as normalize } from "@rollup/pluginutils";
import { blue, red, yellow, green } from "colors/safe";
import { satisfies } from "semver";
import findCacheDir from "find-cache-dir";

import { RollupContext, VerbosityLevel } from "./context";
import { LanguageServiceHost } from "./host";
import { TsCache, convertEmitOutput, getAllReferences, ICode } from "./tscache";
import { tsModule, setTypescriptModule } from "./tsproxy";
import { IOptions } from "./ioptions";
import { parseTsConfig } from "./parse-tsconfig";
import { convertDiagnostic, printDiagnostics } from "./diagnostics";
import { TSLIB, TSLIB_VIRTUAL, tslibSource, tslibVersion } from "./tslib";
import { createFilter } from "./get-options-overrides";

// these use globals during testing and are substituted by rollup-plugin-re during builds
const TS_VERSION_RANGE = (global as any)?.rpt2__TS_VERSION_RANGE || "$TS_VERSION_RANGE";
const ROLLUP_VERSION_RANGE = (global as any)?.rpt2__ROLLUP_VERSION_RANGE || "$ROLLUP_VERSION_RANGE";
const RPT2_VERSION = (global as any)?.rpt2__ROLLUP_VERSION_RANGE || "$RPT2_VERSION";

type RPT2Options = Partial<IOptions>;

export { RPT2Options }

const typescript: PluginImpl<RPT2Options> = (options) =>
{
	let watchMode = false;
	let supportsThisLoad = false;
	let generateRound = 0;
	let rollupOptions: InputOptions;
	let context: RollupContext;
	let filter: ReturnType<typeof createFilter>;
	let parsedConfig: tsTypes.ParsedCommandLine;
	let tsConfigPath: string | undefined;
	let servicesHost: LanguageServiceHost;
	let service: tsTypes.LanguageService;
	let documentRegistry: tsTypes.DocumentRegistry; // keep the same DocumentRegistry between watch cycles
	let cache: TsCache;
	let noErrors = true;
	let transformedFiles: Set<string>;
	const declarations: { [name: string]: { type: tsTypes.OutputFile; map?: tsTypes.OutputFile } } = {};
	const checkedFiles = new Set<string>();

	const getDiagnostics = (id: string, snapshot: tsTypes.IScriptSnapshot) =>
	{
		return cache.getSyntacticDiagnostics(id, snapshot, () =>
		{
			return service.getSyntacticDiagnostics(id);
		}).concat(cache.getSemanticDiagnostics(id, snapshot, () =>
		{
			return service.getSemanticDiagnostics(id);
		}));
	}

	const typecheckFile = (id: string, snapshot: tsTypes.IScriptSnapshot | undefined, tcContext: RollupContext) =>
	{
		if (!snapshot)
			return;

		id = normalize(id);
		checkedFiles.add(id); // must come before print, as that could bail

		const diagnostics = getDiagnostics(id, snapshot);
		printDiagnostics(tcContext, diagnostics, parsedConfig.options.pretty !== false);

		if (diagnostics.length > 0)
			noErrors = false;
	}

	const addDeclaration = (id: string, result: ICode) =>
	{
		if (!result.dts)
			return;

		const key = normalize(id);
		declarations[key] = { type: result.dts, map: result.dtsmap };
		context.debug(() => `${blue("generated declarations")} for '${key}'`);
	}

	/** to be called at the end of Rollup's build phase, before output generation */
	const buildDone = (): void =>
	{
		if (!watchMode && !noErrors)
			context.info(yellow("there were errors or warnings."));

		cache?.done(); // if there's an initialization error in `buildStart`, such as a `tsconfig` error, the cache may not exist yet
	}

	const pluginOptions: IOptions = Object.assign({},
		{
			check: true,
			verbosity: VerbosityLevel.Warning,
			clean: false,
			cacheRoot: findCacheDir({ name: "rollup-plugin-typescript2" }),
			include: ["*.ts+(|x)", "**/*.ts+(|x)"],
			exclude: ["*.d.ts", "**/*.d.ts"],
			abortOnError: true,
			rollupCommonJSResolveHack: false,
			tsconfig: undefined,
			useTsconfigDeclarationDir: false,
			tsconfigOverride: {},
			transformers: [],
			tsconfigDefaults: {},
			objectHashIgnoreUnknownHack: false,
			cwd: process.cwd(),
		}, options as IOptions);

	if (!pluginOptions.typescript) {
		pluginOptions.typescript = require("typescript");
	}
	setTypescriptModule(pluginOptions.typescript);
	documentRegistry = tsModule.createDocumentRegistry();

	const self: Plugin = {

		name: "rpt2",

		options(config)
		{
			rollupOptions = { ...config };
			return config;
		},

		buildStart()
		{
			context = new RollupContext(pluginOptions.verbosity, pluginOptions.abortOnError, this, "rpt2: ");

			watchMode = process.env.ROLLUP_WATCH === "true" || !!this.meta.watchMode; // meta.watchMode was added in 2.14.0 to capture watch via Rollup API (i.e. no env var) (c.f. https://github.com/rollup/rollup/blob/master/CHANGELOG.md#2140)
			({ parsedTsConfig: parsedConfig, fileName: tsConfigPath } = parseTsConfig(context, pluginOptions));

			// print out all versions and configurations
			context.info(`typescript version: ${tsModule.version}`);
			context.info(`tslib version: ${tslibVersion}`);
			context.info(`rollup version: ${this.meta.rollupVersion}`);

			if (!satisfies(tsModule.version, TS_VERSION_RANGE, { includePrerelease: true }))
				context.error(`Installed TypeScript version '${tsModule.version}' is outside of supported range '${TS_VERSION_RANGE}'`);

			if (!satisfies(this.meta.rollupVersion, ROLLUP_VERSION_RANGE, { includePrerelease: true }))
				context.error(`Installed Rollup version '${this.meta.rollupVersion}' is outside of supported range '${ROLLUP_VERSION_RANGE}'`);

			supportsThisLoad = satisfies(this.meta.rollupVersion, ">=2.60.0", { includePrerelease : true }); // this.load is 2.60.0+ only (c.f. https://github.com/rollup/rollup/blob/master/CHANGELOG.md#2600)
			if (!supportsThisLoad)
				context.warn(() => `${yellow("You are using a Rollup version '<2.60.0'")}. This may result in type-only files being ignored.`);

			context.info(`rollup-plugin-typescript2 version: ${RPT2_VERSION}`);
			context.debug(() => `plugin options:\n${JSON.stringify(pluginOptions, (key, value) => key === "typescript" ? `version ${(value as typeof tsModule).version}` : value, 4)}`);
			context.debug(() => `rollup config:\n${JSON.stringify(rollupOptions, undefined, 4)}`);
			context.debug(() => `tsconfig path: ${tsConfigPath}`);

			if (pluginOptions.objectHashIgnoreUnknownHack)
				context.warn(() => `${yellow("You are using 'objectHashIgnoreUnknownHack' option")}. If you enabled it because of async functions, try disabling it now.`);

			if (pluginOptions.rollupCommonJSResolveHack)
				context.warn(() => `${yellow("You are using 'rollupCommonJSResolveHack' option")}. This is no longer needed, try disabling it now.`);

			if (watchMode)
				context.info(`running in watch mode`);

			filter = createFilter(context, pluginOptions, parsedConfig);

			servicesHost = new LanguageServiceHost(parsedConfig, pluginOptions.transformers, pluginOptions.cwd);
			service = tsModule.createLanguageService(servicesHost, documentRegistry);
			servicesHost.setLanguageService(service);

			cache = new TsCache(pluginOptions.clean, pluginOptions.objectHashIgnoreUnknownHack, servicesHost, pluginOptions.cacheRoot, parsedConfig.options, rollupOptions, parsedConfig.fileNames, context);

			// reset transformedFiles Set on each watch cycle
			transformedFiles = new Set<string>();

			// printing compiler option errors
			if (pluginOptions.check) {
				const diagnostics = convertDiagnostic("options", service.getCompilerOptionsDiagnostics());
				printDiagnostics(context, diagnostics, parsedConfig.options.pretty !== false);
				if (diagnostics.length > 0)
					noErrors = false;
			}
		},

		watchChange(id)
		{
			const key = normalize(id);
			delete declarations[key];
			checkedFiles.delete(key);
		},

		resolveId(importee, importer)
		{
			if (importee === TSLIB)
				return TSLIB_VIRTUAL;

			if (!importer)
				return;

			importer = normalize(importer);

			// TODO: use module resolution cache
			const result = tsModule.nodeModuleNameResolver(importee, importer, parsedConfig.options, tsModule.sys);
			const resolved = result.resolvedModule?.resolvedFileName;

			if (!resolved)
				return;

			if (resolved.endsWith(".d.ts"))
				return;

			if (!filter(resolved))
				return;

			cache.setDependency(resolved, importer);

			context.debug(() => `${blue("resolving")} '${importee}' imported by '${importer}'`);
			context.debug(() => `    to '${resolved}'`);

			return pathNormalize(resolved); // use host OS separators to fix Windows issue: https://github.com/ezolenko/rollup-plugin-typescript2/pull/251
		},

		load(id)
		{
			if (id === TSLIB_VIRTUAL)
				return tslibSource;

			return null;
		},

		async transform(code, id)
		{
			transformedFiles.add(id); // note: this does not need normalization as we only compare Rollup <-> Rollup, and not Rollup <-> TS

			if (!filter(id))
				return undefined;

			const snapshot = servicesHost.setSnapshot(id, code);

			// getting compiled file from cache or from ts
			const result = cache.getCompiled(id, snapshot, () =>
			{
				const output = service.getEmitOutput(id);

				if (output.emitSkipped)
				{
					noErrors = false;
					// always checking on fatal errors, even if options.check is set to false
					typecheckFile(id, snapshot, context);
					// since no output was generated, aborting compilation
					this.error(red(`Emit skipped for '${id}'. See https://github.com/microsoft/TypeScript/issues/49790 for potential reasons why this may occur`));
				}

				const references = getAllReferences(id, snapshot, parsedConfig.options);
				return convertEmitOutput(output, references);
			});

			if (pluginOptions.check)
				typecheckFile(id, snapshot, context);

			if (!result)
				return undefined;

			if (watchMode && result.references)
			{
				if (tsConfigPath)
					this.addWatchFile(tsConfigPath);

				result.references.map(this.addWatchFile, this);
				context.debug(() => `${green("    watching")}: ${result.references!.join("\nrpt2:               ")}`);
			}

			addDeclaration(id, result);

			// handle all type-only imports by resolving + loading all of TS's references
			// Rollup can't see these otherwise, because they are "emit-less" and produce no JS
			if (result.references && supportsThisLoad) {
				for (const ref of result.references) {
					if (ref.endsWith(".d.ts"))
						continue;

					const module = await this.resolve(ref, id);
					if (!module || transformedFiles.has(module.id)) // check for circular references (per https://rollupjs.org/guide/en/#thisload)
						continue;

					// wait for all to be loaded (otherwise, as this is async, some may end up only loading after `generateBundle`)
					await this.load({id: module.id});
				}
			}

			// if a user sets this compilerOption, they probably want another plugin (e.g. Babel, ESBuild) to transform their TS instead, while rpt2 just type-checks and/or outputs declarations
			// note that result.code is non-existent if emitDeclarationOnly per https://github.com/ezolenko/rollup-plugin-typescript2/issues/268
			if (parsedConfig.options.emitDeclarationOnly)
			{
				context.debug(() => `${blue("emitDeclarationOnly")} enabled, not transforming TS`);
				return undefined;
			}

			const transformResult: TransformResult = { code: result.code, map: { mappings: "" } };

			if (result.map)
			{
				pluginOptions.sourceMapCallback?.(id, result.map);
				transformResult.map = JSON.parse(result.map);
			}

			return transformResult;
		},

		buildEnd(err)
		{
			generateRound = 0; // in watch mode, buildEnd resets generate count just before generateBundle for each output

			if (err)
			{
				buildDone();
				// workaround: err.stack contains err.message and Rollup prints both, causing duplication, so split out the stack itself if it exists (c.f. https://github.com/ezolenko/rollup-plugin-typescript2/issues/103#issuecomment-1172820658)
				const stackOnly = err.stack?.split(err.message)[1];
				if (stackOnly)
					this.error({ ...err, message: err.message, stack: stackOnly });
				else
					this.error(err);
			}

			if (!pluginOptions.check)
				return buildDone();

			// walkTree once on each cycle when in watch mode
			if (watchMode)
			{
				cache.walkTree((id) =>
				{
					if (!filter(id))
						return;

					const snapshot = servicesHost.getScriptSnapshot(id);
					typecheckFile(id, snapshot, context);
				});
			}

			// type-check missed files as well
			parsedConfig.fileNames.forEach((name) =>
			{
				const key = normalize(name);
				if (checkedFiles.has(key) || !filter(key)) // don't duplicate if it's already been checked
					return;

				context.debug(() => `type-checking missed '${key}'`);
				const snapshot = servicesHost.getScriptSnapshot(key);
				typecheckFile(key, snapshot, context);
			});

			buildDone();
		},

		generateBundle(this, _output)
		{
			context.debug(() => `generating target ${generateRound + 1}`);
			generateRound++;

			if (!parsedConfig.options.declaration)
				return;

			parsedConfig.fileNames.forEach((name) =>
			{
				const key = normalize(name);
				if (key in declarations || !filter(key))
					return;

				context.debug(() => `generating missed declarations for '${key}'`);
				const out = convertEmitOutput(service.getEmitOutput(key, true));
				addDeclaration(key, out);
			});

			const emitDeclaration = (key: string, extension: string, entry?: tsTypes.OutputFile) =>
			{
				if (!entry)
					return;

				let fileName = entry.name;
				if (fileName.includes("?")) // HACK for rollup-plugin-vue, it creates virtual modules in form 'file.vue?rollup-plugin-vue=script.ts'
					fileName = fileName.split("?", 1) + extension;

				// If 'useTsconfigDeclarationDir' is in plugin options, directly write to 'declarationDir'.
				// This may not be under Rollup's output directory, and thus can't be emitted as an asset.
				if (pluginOptions.useTsconfigDeclarationDir)
				{
					context.debug(() => `${blue("emitting declarations")} for '${key}' to '${fileName}'`);
					tsModule.sys.writeFile(fileName, entry.text, entry.writeByteOrderMark);
					return;
				}

				// don't mutate the entry because generateBundle gets called multiple times
				let entryText = entry.text
				const cachePlaceholder = `${pluginOptions.cacheRoot}/placeholder`

				// modify declaration map sources to correct relative path (only if outputting)
				if (extension === ".d.ts.map" && (_output?.file || _output?.dir))
				{
					const declarationDir = (_output.file ? dirname(_output.file) : _output.dir) as string;
					const parsedText = JSON.parse(entryText) as SourceMap;
					// invert back to absolute, then make relative to declarationDir
					parsedText.sources = parsedText.sources.map(source =>
					{
						const absolutePath = resolve(cachePlaceholder, source);
						return normalize(relative(declarationDir, absolutePath));
					});
					entryText = JSON.stringify(parsedText);
				}

				const relativePath = normalize(relative(cachePlaceholder, fileName));
				context.debug(() => `${blue("emitting declarations")} for '${key}' to '${relativePath}'`);
				this.emitFile({
					type: "asset",
					source: entryText,
					fileName: relativePath,
				});
			};

			Object.keys(declarations).forEach((key) =>
			{
				const { type, map } = declarations[key];
				emitDeclaration(key, ".d.ts", type);
				emitDeclaration(key, ".d.ts.map", map);
			});
		},
	};

	return self;
};

export default typescript;
