import { RollupContext } from "./rollupcontext";
import { ConsoleContext, IRollupContext, VerbosityLevel } from "./context";
import { LanguageServiceHost } from "./host";
import { TsCache, convertDiagnostic, IRollupCode, convertEmitOutput } from "./tscache";
import { tsModule, setTypescriptModule } from "./tsproxy";
import * as tsTypes from "typescript";
import * as resolve from "resolve";
import * as _ from "lodash";
import { IRollupOptions } from "./irollup-options";
import { IOptions } from "./ioptions";
import { Partial } from "./partial";
import { parseTsConfig } from "./parse-tsconfig";
import { printDiagnostics } from "./print-diagnostics";
import { TSLIB, tslibSource, tslibVersion } from "./tslib";
import { blue, red, yellow } from "colors/safe";
import { dirname, isAbsolute, join, relative } from "path";
import { normalize } from "./normalize";
import { satisfies } from "semver";

export default function typescript(options?: Partial<IOptions>)
{
	// tslint:disable-next-line:no-var-requires
	const createFilter = require("rollup-pluginutils").createFilter;
	// tslint:enable-next-line:no-var-requires
	let watchMode = false;
	let generateRound = 0;
	let rollupOptions: IRollupOptions;
	let context: ConsoleContext;
	let filter: any;
	let parsedConfig: tsTypes.ParsedCommandLine;
	let servicesHost: LanguageServiceHost;
	let service: tsTypes.LanguageService;
	let noErrors = true;
	const declarations: { [name: string]: { type: tsTypes.OutputFile; map?: tsTypes.OutputFile } } = {};

	let _cache: TsCache;
	const cache = (): TsCache =>
	{
		if (!_cache)
			_cache = new TsCache(pluginOptions.clean, pluginOptions.objectHashIgnoreUnknownHack, servicesHost, pluginOptions.cacheRoot, parsedConfig.options, rollupOptions, parsedConfig.fileNames, context);
		return _cache;
	};

	const pluginOptions = { ...options } as IOptions;

	_.defaults(pluginOptions,
		{
			check: true,
			verbosity: VerbosityLevel.Warning,
			clean: false,
			cacheRoot: `${process.cwd()}/.rpt2_cache`,
			include: ["*.ts+(|x)", "**/*.ts+(|x)"],
			exclude: ["*.d.ts", "**/*.d.ts"],
			abortOnError: true,
			rollupCommonJSResolveHack: false,
			typescript: require("typescript"),
			tsconfig: undefined,
			useTsconfigDeclarationDir: false,
			tsconfigOverride: {},
			transformers: [],
			tsconfigDefaults: {},
			objectHashIgnoreUnknownHack: false,
		});

	setTypescriptModule(pluginOptions.typescript);

	return {

		name: "rpt2",

		options(config: IRollupOptions)
		{
			rollupOptions = {... config};
			context = new ConsoleContext(pluginOptions.verbosity, "rpt2: ");

			context.info(`typescript version: ${tsModule.version}`);
			context.info(`tslib version: ${tslibVersion}`);

			if (!satisfies(tsModule.version, "$TS_VERSION_RANGE", { includePrerelease : true } as any))
				throw new Error(`Installed typescript version '${tsModule.version}' is outside of supported range '$TS_VERSION_RANGE'`);

			context.info(`rollup-plugin-typescript2 version: $RPT2_VERSION`);
			context.debug(() => `plugin options:\n${JSON.stringify(pluginOptions, (key, value) => key === "typescript" ? `version ${(value as typeof tsModule).version}` : value, 4)}`);
			context.debug(() => `rollup config:\n${JSON.stringify(rollupOptions, undefined, 4)}`);

			watchMode = process.env.ROLLUP_WATCH === "true";

			if (watchMode)
				context.info(`running in watch mode`);

			parsedConfig = parseTsConfig(context, pluginOptions);

			if (parsedConfig.options.rootDirs)
			{
				const included = _
					.chain(parsedConfig.options.rootDirs)
					.flatMap((root) =>
					{
						if (pluginOptions.include instanceof Array)
							return pluginOptions.include.map((include) => join(root, include));
						else
							return join(root, pluginOptions.include);
					})
					.uniq()
					.value();

				const excluded = _
					.chain(parsedConfig.options.rootDirs)
					.flatMap((root) =>
					{
						if (pluginOptions.exclude instanceof Array)
							return pluginOptions.exclude.map((exclude) => join(root, exclude));
						else
							return join(root, pluginOptions.exclude);
					})
					.uniq()
					.value();

				filter = createFilter(included, excluded);
				context.debug(() => `included:\n${JSON.stringify(included, undefined, 4)}`);
				context.debug(() => `excluded:\n${JSON.stringify(excluded, undefined, 4)}`);
			}
			else
			{
				filter = createFilter(pluginOptions.include, pluginOptions.exclude);
				context.debug(() => `included:\n'${JSON.stringify(pluginOptions.include, undefined, 4)}'`);
				context.debug(() => `excluded:\n'${JSON.stringify(pluginOptions.exclude, undefined, 4)}'`);
			}

			servicesHost = new LanguageServiceHost(parsedConfig, pluginOptions.transformers);

			service = tsModule.createLanguageService(servicesHost, tsModule.createDocumentRegistry());
			servicesHost.setLanguageService(service);

			// printing compiler option errors
			if (pluginOptions.check)
				printDiagnostics(context, convertDiagnostic("options", service.getCompilerOptionsDiagnostics()), parsedConfig.options.pretty === true);

			if (pluginOptions.clean)
				cache().clean();
		},

		resolveId(importee: string, importer: string)
		{
			if (importee === TSLIB)
				return "\0" + TSLIB;

			if (!importer)
				return null;

			importer = importer.split("\\").join("/");

			// TODO: use module resolution cache
			const result = tsModule.nodeModuleNameResolver(importee, importer, parsedConfig.options, tsModule.sys);

			if (result.resolvedModule && result.resolvedModule.resolvedFileName)
			{
				if (filter(result.resolvedModule.resolvedFileName))
					cache().setDependency(result.resolvedModule.resolvedFileName, importer);

				if (_.endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
					return null;

				const resolved = pluginOptions.rollupCommonJSResolveHack
					? resolve.sync(result.resolvedModule.resolvedFileName)
					: result.resolvedModule.resolvedFileName;

				context.debug(() => `${blue("resolving")} '${importee}'`);
				context.debug(() => `    to '${resolved}'`);

				return resolved;
			}

			return null;
		},

		load(id: string): string | undefined
		{
			if (id === "\0" + TSLIB)
				return tslibSource;

			return undefined;
		},

		transform(this: IRollupContext, code: string, id: string): IRollupCode | undefined
		{
			generateRound = 0; // in watch mode transform call resets generate count (used to avoid printing too many copies of the same error messages)

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
					const diagnostics = _.concat(
						cache().getSyntacticDiagnostics(id, snapshot, () =>
						{
							return service.getSyntacticDiagnostics(id);
						}),
						cache().getSemanticDiagnostics(id, snapshot, () =>
						{
							return service.getSemanticDiagnostics(id);
						}),
					);
					printDiagnostics(contextWrapper, diagnostics, parsedConfig.options.pretty === true);

					// since no output was generated, aborting compilation
					cache().done();
					if (_.isFunction(this.error))
						this.error(red(`failed to transpile '${id}'`));
				}

				return convertEmitOutput(output);
			});

			if (pluginOptions.check)
			{
				const diagnostics = _.concat(
					cache().getSyntacticDiagnostics(id, snapshot, () =>
					{
						return service.getSyntacticDiagnostics(id);
					}),
					cache().getSemanticDiagnostics(id, snapshot, () =>
					{
						return service.getSemanticDiagnostics(id);
					}),
				);

				if (diagnostics.length > 0)
					noErrors = false;

				printDiagnostics(contextWrapper, diagnostics, parsedConfig.options.pretty === true);
			}

			if (result)
			{
				if (result.dts)
				{
					const key = normalize(id);
					declarations[key] = { type: result.dts, map: result.dtsmap };
					context.debug(() => `${blue("generated declarations")} for '${key}'`);
				}

				const transformResult = { code: result.code, map: { mappings: "" } };

				if (result.map)
				{
					if (pluginOptions.sourceMapCallback)
						pluginOptions.sourceMapCallback(id, result.map);
					transformResult.map = JSON.parse(result.map);
				}

				return transformResult;
			}

			return undefined;
		},

		ongenerate(): void
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

					const diagnostics = _.concat(
						cache().getSyntacticDiagnostics(id, snapshot, () =>
						{
							return service.getSyntacticDiagnostics(id);
						}),
						cache().getSemanticDiagnostics(id, snapshot, () =>
						{
							return service.getSemanticDiagnostics(id);
						}),
					);

					printDiagnostics(context, diagnostics, parsedConfig.options.pretty === true);
				});
			}

			if (!watchMode && !noErrors)
				context.info(yellow("there were errors or warnings."));

			cache().done();

			generateRound++;
		},

		onwrite({ dest, file }: IRollupOptions)
		{
			if (parsedConfig.options.declaration)
			{
				_.each(parsedConfig.fileNames, (name) =>
				{
					const key = normalize(name);
					if (_.has(declarations, key) || !filter(key))
						return;
					context.debug(() => `generating missed declarations for '${key}'`);
					const output = service.getEmitOutput(key, true);
					const out = convertEmitOutput(output);
					if (out.dts)
						declarations[key] = { type: out.dts, map: out.dtsmap };
				});

				const bundleFile = file ? file : dest; // rollup 0.48+ has 'file' https://github.com/rollup/rollup/issues/1479

				const writeDeclaration = (key: string, extension: string, entry?: tsTypes.OutputFile) =>
				{
					if (!entry)
						return;

					let fileName = entry.name;
					if (fileName.includes("?")) // HACK for rollup-plugin-vue, it creates virtual modules in form 'file.vue?rollup-plugin-vue=script.ts'
						fileName = fileName.split("?", 1) + extension;

					let writeToPath: string;
					// If for some reason no 'dest' property exists or if 'useTsconfigDeclarationDir' is given in the plugin options,
					// use the path provided by Typescript's LanguageService.
					if (!bundleFile || pluginOptions.useTsconfigDeclarationDir)
						writeToPath = fileName;
					else
					{
						// Otherwise, take the directory name from the path and make sure it is absolute.
						const destDirname = dirname(bundleFile);
						const destDirectory = isAbsolute(destDirname) ? destDirname : join(process.cwd(), destDirname);
						writeToPath = join(destDirectory, relative(process.cwd(), fileName));
					}

					context.debug(() => `${blue("writing declarations")} for '${key}' to '${writeToPath}'`);

					// Write the declaration file to disk.
					tsModule.sys.writeFile(writeToPath, entry.text, entry.writeByteOrderMark);
				};

				_.each(declarations, ({ type, map }, key) =>
				{
					writeDeclaration(key, ".d.ts", type);
					writeDeclaration(key, ".d.ts.map", map);
				});
			}
		},
	};
}
