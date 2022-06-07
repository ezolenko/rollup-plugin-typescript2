import { relative, dirname, normalize as pathNormalize, resolve as pathResolve } from "path";
import * as tsTypes from "typescript";
import { PluginImpl, PluginContext, InputOptions, OutputOptions, TransformResult, SourceMap, Plugin } from "rollup";
import { normalizePath as normalize } from "@rollup/pluginutils";
import * as _ from "lodash";
import { blue, red, yellow, green } from "colors/safe";
import * as resolve from "resolve";
import findCacheDir from "find-cache-dir";

import { RollupContext } from "./rollupcontext";
import { ConsoleContext, VerbosityLevel } from "./context";
import { LanguageServiceHost } from "./host";
import { TsCache, convertDiagnostic, convertEmitOutput, getAllReferences } from "./tscache";
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
	let noErrors = true;
	const declarations: { [name: string]: { type: tsTypes.OutputFile; map?: tsTypes.OutputFile } } = {};
	const allImportedFiles = new Set<string>();

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

	const self: Plugin & { _ongenerate: () => void, _onwrite: (this: PluginContext, _output: OutputOptions) => void } = {

		name: "rpt2",

		options(config)
		{
			rollupOptions = {... config};
			context = new ConsoleContext(pluginOptions.verbosity, "rpt2: ");

			watchMode = process.env.ROLLUP_WATCH === "true";
			({ parsedTsConfig: parsedConfig, fileName: tsConfigPath } = parseTsConfig(context, pluginOptions));

			if (generateRound === 0)
			{
				parsedConfig.fileNames.map(allImportedFiles.add, allImportedFiles);

				context.info(`typescript version: ${tsModule.version}`);
				context.info(`tslib version: ${tslibVersion}`);
				if (this.meta)
					context.info(`rollup version: ${this.meta.rollupVersion}`);

				context.info(`rollup-plugin-typescript2 version: $RPT2_VERSION`);
				context.debug(() => `plugin options:\n${JSON.stringify(pluginOptions, (key, value) => key === "typescript" ? `version ${(value as typeof tsModule).version}` : value, 4)}`);
				context.debug(() => `rollup config:\n${JSON.stringify(rollupOptions, undefined, 4)}`);
				context.debug(() => `tsconfig path: ${tsConfigPath}`);

				if (pluginOptions.objectHashIgnoreUnknownHack)
					context.warn(() => `${yellow("You are using 'objectHashIgnoreUnknownHack' option")}. If you enabled it because of async functions, try disabling it now.`);

				if (watchMode)
					context.info(`running in watch mode`);
			}

			filter = createFilter(context, pluginOptions, parsedConfig);

			servicesHost = new LanguageServiceHost(parsedConfig, pluginOptions.transformers, pluginOptions.cwd);

			service = tsModule.createLanguageService(servicesHost, tsModule.createDocumentRegistry());
			servicesHost.setLanguageService(service);

			// printing compiler option errors
			if (pluginOptions.check) {
				const diagnostics = convertDiagnostic("options", service.getCompilerOptionsDiagnostics());
				printDiagnostics(context, diagnostics, parsedConfig.options.pretty === true);
				if (diagnostics.length > 0)
					noErrors = false;
			}

			if (pluginOptions.clean)
				cache().clean();

			return config;
		},

		watchChange(id)
		{
			const key = normalize(id);
			delete declarations[key];
		},

		resolveId(importee, importer)
		{
			if (importee === TSLIB)
				return TSLIB_VIRTUAL;

			if (!importer)
				return;

			importer = normalize(importer);

			// avoiding trying to resolve ids for things imported from files unrelated to this plugin
			if (!allImportedFiles.has(importer))
				return;

			// TODO: use module resolution cache
			const result = tsModule.nodeModuleNameResolver(importee, importer, parsedConfig.options, tsModule.sys);
			let resolved = result.resolvedModule?.resolvedFileName;

			if (!resolved)
				return;

			if (filter(resolved))
				cache().setDependency(resolved, importer);

			if (resolved.endsWith(".d.ts"))
				return;

			if (pluginOptions.rollupCommonJSResolveHack)
				resolved = resolve.sync(resolved);

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
			generateRound = 0; // in watch mode transform call resets generate count (used to avoid printing too many copies of the same error messages)

			if (!filter(id))
				return undefined;

			allImportedFiles.add(normalize(id));

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
					const diagnostics = getDiagnostics(id, snapshot);
					printDiagnostics(contextWrapper, diagnostics, parsedConfig.options.pretty === true);

					// since no output was generated, aborting compilation
					cache().done();
					if (_.isFunction(this.error))
						this.error(red(`failed to transpile '${id}'`));
				}

				const references = getAllReferences(id, snapshot, parsedConfig.options);
				return convertEmitOutput(output, references);
			});

			if (pluginOptions.check)
			{
				const diagnostics = getDiagnostics(id, snapshot);
				if (diagnostics.length > 0)
					noErrors = false;

				printDiagnostics(contextWrapper, diagnostics, parsedConfig.options.pretty === true);
			}

			if (!result)
				return undefined;

			if (result.references)
				result.references.map(normalize).map(allImportedFiles.add, allImportedFiles);

			if (watchMode && this.addWatchFile && result.references)
			{
				if (tsConfigPath)
					this.addWatchFile(tsConfigPath);
				result.references.map(this.addWatchFile, this);
				context.debug(() => `${green("    watching")}: ${result.references!.join("\nrpt2:               ")}`);
			}

			if (result.dts)
			{
				const key = normalize(id);
				declarations[key] = { type: result.dts, map: result.dtsmap };
				context.debug(() => `${blue("generated declarations")} for '${key}'`);
			}

			const transformResult: TransformResult = { code: result.code, map: { mappings: "" } };

			if (result.map)
			{
				if (pluginOptions.sourceMapCallback)
					pluginOptions.sourceMapCallback(id, result.map);
				transformResult.map = JSON.parse(result.map);
			}

			return transformResult;
		},

		generateBundle(bundleOptions)
		{
			self._ongenerate();
			self._onwrite.call(this, bundleOptions);
		},

		_ongenerate(): void
		{
			context.debug(() => `generating target ${generateRound + 1}`);

			if (pluginOptions.check && watchMode && generateRound === 0)
			{
				cache().walkTree((id) =>
				{
					if (!filter(id))
						return;

					const snapshot = servicesHost.getScriptSnapshot(id);
					if (!snapshot)
						return;

					const diagnostics = getDiagnostics(id, snapshot);
					printDiagnostics(context, diagnostics, parsedConfig.options.pretty === true);
				});
			}

			if (!watchMode && !noErrors)
				context.info(yellow("there were errors or warnings."));

			cache().done();

			generateRound++;
		},

		_onwrite(this: PluginContext, _output: OutputOptions): void
		{
			if (!parsedConfig.options.declaration)
				return;

			parsedConfig.fileNames.forEach((name) =>
			{
				const key = normalize(name);
				if (key in declarations)
					return;
				if (!allImportedFiles.has(key))
				{
					context.debug(() => `skipping declarations for unused '${key}'`);
					return;
				}

				context.debug(() => `generating missed declarations for '${key}'`);
				const output = service.getEmitOutput(key, true);
				const out = convertEmitOutput(output);
				if (out.dts)
					declarations[key] = { type: out.dts, map: out.dtsmap };
			});

			const emitDeclaration = (key: string, extension: string, entry?: tsTypes.OutputFile) =>
			{
				if (!entry)
					return;

				let fileName = entry.name;
				if (fileName.includes("?")) // HACK for rollup-plugin-vue, it creates virtual modules in form 'file.vue?rollup-plugin-vue=script.ts'
					fileName = fileName.split(".vue?", 1) + extension;

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
						const absolutePath = pathResolve(cachePlaceholder, source);
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
