import { relative, dirname, normalize as pathNormalize, resolve } from "path";
import * as tsTypes from "typescript";
import { PluginImpl, InputOptions, TransformResult, SourceMap, Plugin } from "rollup";
import { normalizePath as normalize } from "@rollup/pluginutils";
import { blue, red, yellow, green } from "colors/safe";
import findCacheDir from "find-cache-dir";

import { ConsoleContext, RollupContext, IContext, VerbosityLevel } from "./context";
import { LanguageServiceHost } from "./host";
import { TsCache, convertDiagnostic, convertEmitOutput, getAllReferences, ICode } from "./tscache";
import { tsModule, setTypescriptModule } from "./tsproxy";
import { IOptions } from "./ioptions";
import { parseTsConfig } from "./parse-tsconfig";
import { printDiagnostics } from "./print-diagnostics";
import { TSLIB, TSLIB_VIRTUAL, tslibSource, tslibVersion } from "./tslib";
import { createFilter } from "./get-options-overrides";

type RPT2Options = Partial<IOptions>;

export { RPT2Options }

const typescript: PluginImpl<RPT2Options> = (options) =>
{
	let watchMode = false;
	let generateRound = 0;
	let rollupOptions: InputOptions;
	let context: ConsoleContext;
	let filter: any;
	let parsedConfig: tsTypes.ParsedCommandLine;
	let tsConfigPath: string | undefined;
	let servicesHost: LanguageServiceHost;
	let service: tsTypes.LanguageService;
	let documentRegistry: tsTypes.DocumentRegistry; // keep the same DocumentRegistry between watch cycles
	let noErrors = true;
	const declarations: { [name: string]: { type: tsTypes.OutputFile; map?: tsTypes.OutputFile } } = {};
	const checkedFiles = new Set<string>();

	let _cache: TsCache;
	const cache = (): TsCache =>
	{
		if (!_cache)
			_cache = new TsCache(pluginOptions.clean, pluginOptions.objectHashIgnoreUnknownHack, servicesHost, pluginOptions.cacheRoot, parsedConfig.options, rollupOptions, parsedConfig.fileNames, context);
		return _cache;
	};

	const getDiagnostics = (id: string, snapshot: tsTypes.IScriptSnapshot) =>
	{
		return cache().getSyntacticDiagnostics(id, snapshot, () =>
		{
			return service.getSyntacticDiagnostics(id);
		}).concat(cache().getSemanticDiagnostics(id, snapshot, () =>
		{
			return service.getSemanticDiagnostics(id);
		}));
	}

	const typecheckFile = (id: string, snapshot: tsTypes.IScriptSnapshot | undefined, tcContext: IContext) =>
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

		cache().done();
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
			rollupOptions = {... config};
			context = new ConsoleContext(pluginOptions.verbosity, "rpt2: ");

			watchMode = process.env.ROLLUP_WATCH === "true" || !!this.meta.watchMode; // meta.watchMode was added in 2.14.0 to capture watch via Rollup API (i.e. no env var) (c.f. https://github.com/rollup/rollup/blob/master/CHANGELOG.md#2140)
			({ parsedTsConfig: parsedConfig, fileName: tsConfigPath } = parseTsConfig(context, pluginOptions));

			// print out all versions and configurations
			context.info(`typescript version: ${tsModule.version}`);
			context.info(`tslib version: ${tslibVersion}`);
			context.info(`rollup version: ${this.meta.rollupVersion}`);

			context.info(`rollup-plugin-typescript2 version: $RPT2_VERSION`);
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

			// printing compiler option errors
			if (pluginOptions.check) {
				const diagnostics = convertDiagnostic("options", service.getCompilerOptionsDiagnostics());
				printDiagnostics(context, diagnostics, parsedConfig.options.pretty !== false);
				if (diagnostics.length > 0)
					noErrors = false;
			}

			return config;
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

			if (filter(resolved))
				cache().setDependency(resolved, importer);

			if (resolved.endsWith(".d.ts"))
				return;

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

		transform(code, id)
		{
			if (!filter(id))
				return undefined;

			const contextWrapper = new RollupContext(pluginOptions.verbosity, pluginOptions.abortOnError, this, "rpt2: ");

			const snapshot = servicesHost.setSnapshot(id, code);

			// getting compiled file from cache or from ts
			const result = cache().getCompiled(id, snapshot, () =>
			{
				const output = service.getEmitOutput(id);

				if (output.emitSkipped)
				{
					noErrors = false;
					// always checking on fatal errors, even if options.check is set to false
					typecheckFile(id, snapshot, contextWrapper);
					// since no output was generated, aborting compilation
					this.error(red(`Emit skipped for '${id}'. See https://github.com/microsoft/TypeScript/issues/49790 for potential reasons why this may occur`));
				}

				const references = getAllReferences(id, snapshot, parsedConfig.options);
				return convertEmitOutput(output, references);
			});

			if (pluginOptions.check)
				typecheckFile(id, snapshot, contextWrapper);

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

			// if a user sets this compilerOption, they probably want another plugin (e.g. Babel, ESBuild) to transform their TS instead, while rpt2 just type-checks and/or outputs declarations
			// note that result.code is non-existent if emitDeclarationOnly per https://github.com/ezolenko/rollup-plugin-typescript2/issues/268
			if (parsedConfig.options.emitDeclarationOnly)
			{
				context.debug(() => `${blue("emitDeclarationOnly")} enabled, not transforming TS'`);
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
				cache().walkTree((id) =>
				{
					if (!filter(id))
						return;

					const snapshot = servicesHost.getScriptSnapshot(id);
					typecheckFile(id, snapshot, context);
				});
			}

			const contextWrapper = new RollupContext(pluginOptions.verbosity, pluginOptions.abortOnError, this, "rpt2: ");

			// type-check missed files as well
			parsedConfig.fileNames.forEach((name) =>
			{
				const key = normalize(name);
				if (checkedFiles.has(key) || !filter(key)) // don't duplicate if it's already been checked
					return;

				context.debug(() => `type-checking missed '${key}'`);
				const snapshot = servicesHost.getScriptSnapshot(key);
				typecheckFile(key, snapshot, contextWrapper);
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
