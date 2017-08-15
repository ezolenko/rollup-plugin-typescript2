import { RollupContext } from "./rollupcontext";
import { ConsoleContext, IRollupContext, VerbosityLevel } from "./context";
import { LanguageServiceHost } from "./host";
import { TsCache, convertDiagnostic, ICode } from "./tscache";
import { tsModule, setTypescriptModule } from "./tsproxy";
import * as tsTypes from "typescript";
import * as resolve from "resolve";
import * as _ from "lodash";
import { IRollupOptions } from "./irollup-options";
import { IOptions } from "./ioptions";
import { Partial } from "./partial";
import { parseTsConfig } from "./parse-ts-config";
import { printDiagnostics } from "./print-diagnostics";
import { TSLIB, tslibSource } from "./tslib";
import { blue, red, yellow } from "colors/safe";
import { join, relative, dirname, isAbsolute } from "path";
import { normalize } from "./normalize";

export default function typescript(options?: Partial<IOptions>)
{
	// tslint:disable-next-line:no-var-requires
	const createFilter = require("rollup-pluginutils").createFilter;
	// tslint:enable-next-line:no-var-requires
	let watchMode = false;
	let round = 0;
	let targetCount = 0;
	let rollupOptions: IRollupOptions;
	let context: ConsoleContext;
	let filter: any;
	let parsedConfig: tsTypes.ParsedCommandLine;
	let servicesHost: LanguageServiceHost;
	let service: tsTypes.LanguageService;
	let noErrors = true;
	const declarations: { [name: string]: tsTypes.OutputFile } = {};

	let _cache: TsCache;
	const cache = (): TsCache =>
	{
		if (!_cache)
			_cache = new TsCache(servicesHost, pluginOptions.cacheRoot, parsedConfig.options, rollupOptions, parsedConfig.fileNames, context);
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
			tsconfig: "tsconfig.json",
			useTsconfigDeclarationDir: false,
			typescript: require("typescript"),
		});

	setTypescriptModule(pluginOptions.typescript);

	return {

		options(config: IRollupOptions)
		{
			rollupOptions = config;
			context = new ConsoleContext(pluginOptions.verbosity, "rpt2: ");

			context.info(`Typescript version: ${tsModule.version}`);
			context.debug(`Plugin Options: ${JSON.stringify(pluginOptions, (key, value) => key === "typescript" ? `version ${(value as typeof tsModule).version}` : value, 4)}`);

			filter = createFilter(pluginOptions.include, pluginOptions.exclude);

			parsedConfig = parseTsConfig(pluginOptions.tsconfig, context, pluginOptions);

			servicesHost = new LanguageServiceHost(parsedConfig);

			service = tsModule.createLanguageService(servicesHost, tsModule.createDocumentRegistry());

			// printing compiler option errors
			if (pluginOptions.check)
				printDiagnostics(context, convertDiagnostic("options", service.getCompilerOptionsDiagnostics()));

			context.debug(`rollupConfig: ${JSON.stringify(rollupOptions, undefined, 4)}`);

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

				context.debug(`${blue("resolving")} '${importee}'`);
				context.debug(`    to '${resolved}'`);

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

		transform(this: IRollupContext, code: string, id: string): ICode | undefined
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
					printDiagnostics(contextWrapper, diagnostics);

					// since no output was generated, aborting compilation
					cache().done();
					if (_.isFunction(this.error))
						this.error(red(`failed to transpile '${id}'`));
				}

				const transpiled = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".js") || _.endsWith(entry.name, ".jsx"));
				const map = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".map"));
				const dts = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".d.ts"));

				return {
					code: transpiled ? transpiled.text : undefined,
					map: map ? JSON.parse(map.text) : { mappings: "" },
					dts,
				};
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

				printDiagnostics(contextWrapper, diagnostics);
			}

			if (result && result.dts)
			{
				const key = normalize(id);
				declarations[key] = result.dts;
				context.debug(`${blue("generated declarations")} for '${key}'`);
				result.dts = undefined;
			}

			return result;
		},

		ongenerate(bundleOptions: any): void
		{
			targetCount = _.get(bundleOptions, "targets.length", 1);

			if (round >= targetCount) // ongenerate() is called for each target
			{
				watchMode = true;
				round = 0;
			}
			context.debug(`generating target ${round + 1} of ${targetCount}`);

			if (watchMode && round === 0)
			{
				context.debug("running in watch mode");

				cache().walkTree((id) =>
				{
					const diagnostics = _.concat(
						convertDiagnostic("syntax", service.getSyntacticDiagnostics(id)),
						convertDiagnostic("semantic", service.getSemanticDiagnostics(id)),
					);

					printDiagnostics(context, diagnostics);
				});
			}

			if (!watchMode && !noErrors)
				context.info(yellow("there were errors or warnings above."));

			cache().done();

			round++;
		},

		onwrite({ dest }: IRollupOptions)
		{
			if (parsedConfig.options.declaration)
			{
				_.each(parsedConfig.fileNames, (name) =>
				{
					const key = normalize(name);
					if (_.has(declarations, key) || !filter(key))
						return;
					context.debug(`generating missed declarations for '${key}'`);
					const output = service.getEmitOutput(key, true);
					const dts = _.find(output.outputFiles, (entry) => _.endsWith(entry.name, ".d.ts"));
					if (dts)
						declarations[key] = dts;
				});

				const baseDeclarationDir = parsedConfig.options.outDir;
				_.each(declarations, ({ name, text, writeByteOrderMark }, key) =>
				{
					let writeToPath: string;
					// If for some reason no 'dest' property exists or if 'useTsconfigDeclarationDir' is given in the plugin options,
					// use the path provided by Typescript's LanguageService.
					if (!dest || pluginOptions.useTsconfigDeclarationDir)
						writeToPath = name;
					else
					{
						// Otherwise, take the directory name from the path and make sure it is absolute.
						const destDirname = dirname(dest);
						const destDirectory = isAbsolute(dest) ? destDirname : join(process.cwd(), destDirname);
						writeToPath = join(destDirectory, relative(baseDeclarationDir!, name));
					}

					context.debug(`${blue("writing declarations")} for '${key}' to '${writeToPath}'`);

					// Write the declaration file to disk.
					tsModule.sys.writeFile(writeToPath, text, writeByteOrderMark);
				});
			}
		},
	};
}
