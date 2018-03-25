/* eslint-disable */
'use strict';

var _ = require('lodash');
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');
var graphlib = require('graphlib');
var objectHash = require('object-hash');
var safe = require('colors/safe');
var tslib_1 = require('tslib');
var resolve = require('resolve');

var VerbosityLevel;
(function (VerbosityLevel) {
    VerbosityLevel[VerbosityLevel["Error"] = 0] = "Error";
    VerbosityLevel[VerbosityLevel["Warning"] = 1] = "Warning";
    VerbosityLevel[VerbosityLevel["Info"] = 2] = "Info";
    VerbosityLevel[VerbosityLevel["Debug"] = 3] = "Debug";
})(VerbosityLevel || (VerbosityLevel = {}));
var ConsoleContext = /** @class */ (function () {
    function ConsoleContext(verbosity, prefix) {
        if (prefix === void 0) { prefix = ""; }
        this.verbosity = verbosity;
        this.prefix = prefix;
    }
    ConsoleContext.prototype.warn = function (message) {
        if (this.verbosity < VerbosityLevel.Warning)
            return;
        console.log("" + this.prefix + (_.isFunction(message) ? message() : message));
    };
    ConsoleContext.prototype.error = function (message) {
        if (this.verbosity < VerbosityLevel.Error)
            return;
        console.log("" + this.prefix + (_.isFunction(message) ? message() : message));
    };
    ConsoleContext.prototype.info = function (message) {
        if (this.verbosity < VerbosityLevel.Info)
            return;
        console.log("" + this.prefix + (_.isFunction(message) ? message() : message));
    };
    ConsoleContext.prototype.debug = function (message) {
        if (this.verbosity < VerbosityLevel.Debug)
            return;
        console.log("" + this.prefix + (_.isFunction(message) ? message() : message));
    };
    return ConsoleContext;
}());

var RollupContext = /** @class */ (function () {
    function RollupContext(verbosity, bail, context, prefix) {
        if (prefix === void 0) { prefix = ""; }
        this.verbosity = verbosity;
        this.bail = bail;
        this.context = context;
        this.prefix = prefix;
        this.hasContext = true;
        this.hasContext = _.isFunction(this.context.warn) && _.isFunction(this.context.error);
    }
    RollupContext.prototype.warn = function (message) {
        if (this.verbosity < VerbosityLevel.Warning)
            return;
        var text = _.isFunction(message) ? message() : message;
        if (this.hasContext)
            this.context.warn("" + text);
        else
            console.log("" + this.prefix + text);
    };
    RollupContext.prototype.error = function (message) {
        if (this.verbosity < VerbosityLevel.Error)
            return;
        var text = _.isFunction(message) ? message() : message;
        if (this.hasContext) {
            if (this.bail)
                this.context.error("" + text);
            else
                this.context.warn("" + text);
        }
        else
            console.log("" + this.prefix + text);
    };
    RollupContext.prototype.info = function (message) {
        if (this.verbosity < VerbosityLevel.Info)
            return;
        var text = _.isFunction(message) ? message() : message;
        console.log("" + this.prefix + text);
    };
    RollupContext.prototype.debug = function (message) {
        if (this.verbosity < VerbosityLevel.Debug)
            return;
        var text = _.isFunction(message) ? message() : message;
        console.log("" + this.prefix + text);
    };
    return RollupContext;
}());

var tsModule;
function setTypescriptModule(override) {
    tsModule = override;
}

function normalize(fileName) {
    return fileName.split("\\").join("/");
}

var LanguageServiceHost = /** @class */ (function () {
    function LanguageServiceHost(parsedConfig) {
        this.parsedConfig = parsedConfig;
        this.cwd = process.cwd();
        this.snapshots = {};
        this.versions = {};
    }
    LanguageServiceHost.prototype.reset = function () {
        this.snapshots = {};
        this.versions = {};
    };
    LanguageServiceHost.prototype.setSnapshot = function (fileName, data) {
        fileName = normalize(fileName);
        var snapshot = tsModule.ScriptSnapshot.fromString(data);
        this.snapshots[fileName] = snapshot;
        this.versions[fileName] = (this.versions[fileName] || 0) + 1;
        return snapshot;
    };
    LanguageServiceHost.prototype.getScriptSnapshot = function (fileName) {
        fileName = normalize(fileName);
        if (_.has(this.snapshots, fileName))
            return this.snapshots[fileName];
        if (fs.existsSync(fileName)) {
            this.snapshots[fileName] = tsModule.ScriptSnapshot.fromString(tsModule.sys.readFile(fileName));
            this.versions[fileName] = (this.versions[fileName] || 0) + 1;
            return this.snapshots[fileName];
        }
        return undefined;
    };
    LanguageServiceHost.prototype.getCurrentDirectory = function () {
        return this.cwd;
    };
    LanguageServiceHost.prototype.getScriptVersion = function (fileName) {
        fileName = normalize(fileName);
        return (this.versions[fileName] || 0).toString();
    };
    LanguageServiceHost.prototype.getScriptFileNames = function () {
        return this.parsedConfig.fileNames;
    };
    LanguageServiceHost.prototype.getCompilationSettings = function () {
        return this.parsedConfig.options;
    };
    LanguageServiceHost.prototype.getDefaultLibFileName = function (opts) {
        return tsModule.getDefaultLibFilePath(opts);
    };
    LanguageServiceHost.prototype.useCaseSensitiveFileNames = function () {
        return tsModule.sys.useCaseSensitiveFileNames;
    };
    LanguageServiceHost.prototype.readDirectory = function (path$$1, extensions, exclude, include) {
        return tsModule.sys.readDirectory(path$$1, extensions, exclude, include);
    };
    LanguageServiceHost.prototype.readFile = function (path$$1, encoding) {
        return tsModule.sys.readFile(path$$1, encoding);
    };
    LanguageServiceHost.prototype.fileExists = function (path$$1) {
        return tsModule.sys.fileExists(path$$1);
    };
    LanguageServiceHost.prototype.getTypeRootsVersion = function () {
        return 0;
    };
    LanguageServiceHost.prototype.directoryExists = function (directoryName) {
        return tsModule.sys.directoryExists(directoryName);
    };
    LanguageServiceHost.prototype.getDirectories = function (directoryName) {
        return tsModule.sys.getDirectories(directoryName);
    };
    return LanguageServiceHost;
}());

/**
 * Saves data in new cache folder or reads it from old one.
 * Avoids perpetually growing cache and situations when things need to consider changed and then reverted data to be changed.
 */
var RollingCache = /** @class */ (function () {
    /**
     * @param cacheRoot: root folder for the cache
     * @param checkNewCache: whether to also look in new cache when reading from cache
     */
    function RollingCache(cacheRoot, checkNewCache) {
        this.cacheRoot = cacheRoot;
        this.checkNewCache = checkNewCache;
        this.rolled = false;
        this.oldCacheRoot = this.cacheRoot + "/cache";
        this.newCacheRoot = this.cacheRoot + "/cache_";
        fsExtra.emptyDirSync(this.newCacheRoot);
    }
    /**
     * @returns true if name exist in old cache (or either old of new cache if checkNewCache is true)
     */
    RollingCache.prototype.exists = function (name) {
        if (this.rolled)
            return false;
        if (this.checkNewCache && fs.existsSync(this.newCacheRoot + "/" + name))
            return true;
        return fs.existsSync(this.oldCacheRoot + "/" + name);
    };
    RollingCache.prototype.path = function (name) {
        return this.oldCacheRoot + "/" + name;
    };
    /**
     * @returns true if old cache contains all names and nothing more
     */
    RollingCache.prototype.match = function (names) {
        if (this.rolled)
            return false;
        if (!fs.existsSync(this.oldCacheRoot))
            return names.length === 0; // empty folder matches
        return _.isEqual(fs.readdirSync(this.oldCacheRoot).sort(), names.sort());
    };
    /**
     * @returns data for name, must exist in old cache (or either old of new cache if checkNewCache is true)
     */
    RollingCache.prototype.read = function (name) {
        if (this.checkNewCache && fs.existsSync(this.newCacheRoot + "/" + name))
            return fsExtra.readJsonSync(this.newCacheRoot + "/" + name, { encoding: "utf8", throws: false });
        return fsExtra.readJsonSync(this.oldCacheRoot + "/" + name, { encoding: "utf8", throws: false });
    };
    RollingCache.prototype.write = function (name, data) {
        if (this.rolled)
            return;
        if (data === undefined)
            return;
        fsExtra.writeJsonSync(this.newCacheRoot + "/" + name, data);
    };
    RollingCache.prototype.touch = function (name) {
        if (this.rolled)
            return;
        fsExtra.ensureFileSync(this.newCacheRoot + "/" + name);
    };
    /**
     * clears old cache and moves new in its place
     */
    RollingCache.prototype.roll = function () {
        if (this.rolled)
            return;
        this.rolled = true;
        fsExtra.removeSync(this.oldCacheRoot);
        fs.renameSync(this.newCacheRoot, this.oldCacheRoot);
    };
    return RollingCache;
}());

var FormatHost = /** @class */ (function () {
    function FormatHost() {
    }
    FormatHost.prototype.getCurrentDirectory = function () {
        return tsModule.sys.getCurrentDirectory();
    };
    FormatHost.prototype.getCanonicalFileName = function (fileName) {
        return path.normalize(fileName);
    };
    FormatHost.prototype.getNewLine = function () {
        return tsModule.sys.newLine;
    };
    return FormatHost;
}());
var formatHost = new FormatHost();

function convertDiagnostic(type, data) {
    return _.map(data, function (diagnostic) {
        var entry = {
            flatMessage: tsModule.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
            formatted: tsModule.formatDiagnosticsWithColorAndContext(data, formatHost),
            category: diagnostic.category,
            code: diagnostic.code,
            type: type,
        };
        if (diagnostic.file && diagnostic.start !== undefined) {
            var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
            entry.fileLine = diagnostic.file.fileName + "(" + (line + 1) + "," + (character + 1) + ")";
        }
        return entry;
    });
}
var TsCache = /** @class */ (function () {
    function TsCache(host, cache, options, rollupConfig, rootFilenames, context) {
        var _this = this;
        this.host = host;
        this.options = options;
        this.rollupConfig = rollupConfig;
        this.context = context;
        this.cacheVersion = "7";
        this.ambientTypesDirty = false;
        this.cacheDir = cache + "/" + objectHash.sha1({
            version: this.cacheVersion,
            rootFilenames: rootFilenames,
            options: this.options,
            rollupConfig: this.rollupConfig,
            tsVersion: tsModule.version,
        });
        this.dependencyTree = new graphlib.Graph({ directed: true });
        this.dependencyTree.setDefaultNodeLabel(function (_node) { return ({ dirty: false }); });
        var automaticTypes = _.map(tsModule.getAutomaticTypeDirectiveNames(options, tsModule.sys), function (entry) { return tsModule.resolveTypeReferenceDirective(entry, undefined, options, tsModule.sys); })
            .filter(function (entry) { return entry.resolvedTypeReferenceDirective && entry.resolvedTypeReferenceDirective.resolvedFileName; })
            .map(function (entry) { return entry.resolvedTypeReferenceDirective.resolvedFileName; });
        this.ambientTypes = _.filter(rootFilenames, function (file) { return _.endsWith(file, ".d.ts"); })
            .concat(automaticTypes)
            .map(function (id) { return ({ id: id, snapshot: _this.host.getScriptSnapshot(id) }); });
        this.init();
        this.checkAmbientTypes();
    }
    TsCache.prototype.clean = function () {
        this.context.info(safe.blue("cleaning cache: " + this.cacheDir));
        fsExtra.emptyDirSync(this.cacheDir);
        this.init();
    };
    TsCache.prototype.setDependency = function (importee, importer) {
        // importee -> importer
        this.context.debug(safe.blue("dependency") + " '" + importee + "'");
        this.context.debug("    imported by '" + importer + "'");
        this.dependencyTree.setEdge(importer, importee);
    };
    TsCache.prototype.walkTree = function (cb) {
        var acyclic = graphlib.alg.isAcyclic(this.dependencyTree);
        if (acyclic) {
            _.each(graphlib.alg.topsort(this.dependencyTree), function (id) { return cb(id); });
            return;
        }
        this.context.info(safe.yellow("import tree has cycles"));
        _.each(this.dependencyTree.nodes(), function (id) { return cb(id); });
    };
    TsCache.prototype.done = function () {
        this.context.info(safe.blue("rolling caches"));
        this.codeCache.roll();
        this.semanticDiagnosticsCache.roll();
        this.syntacticDiagnosticsCache.roll();
        this.typesCache.roll();
    };
    TsCache.prototype.getCompiled = function (id, snapshot, transform) {
        var name = this.makeName(id, snapshot);
        this.context.info(safe.blue("transpiling") + " '" + id + "'");
        this.context.debug("    cache: '" + this.codeCache.path(name) + "'");
        if (this.codeCache.exists(name) && !this.isDirty(id, false)) {
            this.context.debug(safe.green("    cache hit"));
            var data = this.codeCache.read(name);
            if (data) {
                this.codeCache.write(name, data);
                return data;
            }
            else
                this.context.warn(safe.yellow("    cache broken, discarding"));
        }
        this.context.debug(safe.yellow("    cache miss"));
        var transformedData = transform();
        this.codeCache.write(name, transformedData);
        this.markAsDirty(id);
        return transformedData;
    };
    TsCache.prototype.getSyntacticDiagnostics = function (id, snapshot, check) {
        return this.getDiagnostics("syntax", this.syntacticDiagnosticsCache, id, snapshot, check);
    };
    TsCache.prototype.getSemanticDiagnostics = function (id, snapshot, check) {
        return this.getDiagnostics("semantic", this.semanticDiagnosticsCache, id, snapshot, check);
    };
    TsCache.prototype.checkAmbientTypes = function () {
        var _this = this;
        this.context.debug(safe.blue("Ambient types:"));
        var typeNames = _.filter(this.ambientTypes, function (snapshot) { return snapshot.snapshot !== undefined; })
            .map(function (snapshot) {
            _this.context.debug("    " + snapshot.id);
            return _this.makeName(snapshot.id, snapshot.snapshot);
        });
        // types dirty if any d.ts changed, added or removed
        this.ambientTypesDirty = !this.typesCache.match(typeNames);
        if (this.ambientTypesDirty)
            this.context.info(safe.yellow("ambient types changed, redoing all semantic diagnostics"));
        _.each(typeNames, function (name) { return _this.typesCache.touch(name); });
    };
    TsCache.prototype.getDiagnostics = function (type, cache, id, snapshot, check) {
        var name = this.makeName(id, snapshot);
        this.context.debug("    cache: '" + cache.path(name) + "'");
        if (cache.exists(name) && !this.isDirty(id, true)) {
            this.context.debug(safe.green("    cache hit"));
            var data = cache.read(name);
            if (data) {
                cache.write(name, data);
                return data;
            }
            else
                this.context.warn(safe.yellow("    cache broken, discarding"));
        }
        this.context.debug(safe.yellow("    cache miss"));
        var convertedData = convertDiagnostic(type, check());
        cache.write(name, convertedData);
        this.markAsDirty(id);
        return convertedData;
    };
    TsCache.prototype.init = function () {
        this.codeCache = new RollingCache(this.cacheDir + "/code", true);
        this.typesCache = new RollingCache(this.cacheDir + "/types", true);
        this.syntacticDiagnosticsCache = new RollingCache(this.cacheDir + "/syntacticDiagnostics", true);
        this.semanticDiagnosticsCache = new RollingCache(this.cacheDir + "/semanticDiagnostics", true);
    };
    TsCache.prototype.markAsDirty = function (id) {
        this.dependencyTree.setNode(id, { dirty: true });
    };
    // returns true if node or any of its imports or any of global types changed
    TsCache.prototype.isDirty = function (id, checkImports) {
        var _this = this;
        var label = this.dependencyTree.node(id);
        if (!label)
            return false;
        if (!checkImports || label.dirty)
            return label.dirty;
        if (this.ambientTypesDirty)
            return true;
        var dependencies = graphlib.alg.dijkstra(this.dependencyTree, id);
        return _.some(dependencies, function (dependency, node) {
            if (!node || dependency.distance === Infinity)
                return false;
            var l = _this.dependencyTree.node(node);
            var dirty = l === undefined ? true : l.dirty;
            if (dirty)
                _this.context.debug("    import changed: " + node);
            return dirty;
        });
    };
    TsCache.prototype.makeName = function (id, snapshot) {
        var data = snapshot.getText(0, snapshot.getLength());
        return objectHash.sha1({ data: data, id: id });
    };
    return TsCache;
}());

function printDiagnostics(context, diagnostics, pretty) {
    _.each(diagnostics, function (diagnostic) {
        var print;
        var color;
        var category;
        switch (diagnostic.category) {
            case tsModule.DiagnosticCategory.Message:
                print = context.info;
                color = safe.white;
                category = "";
                break;
            case tsModule.DiagnosticCategory.Error:
                print = context.error;
                color = safe.red;
                category = "error";
                break;
            case tsModule.DiagnosticCategory.Warning:
            default:
                print = context.warn;
                color = safe.yellow;
                category = "warning";
                break;
        }
        var type = diagnostic.type + " ";
        if (pretty)
            print.call(context, ["" + diagnostic.formatted]);
        else {
            if (diagnostic.fileLine !== undefined)
                print.call(context, [diagnostic.fileLine + ": " + type + category + " TS" + diagnostic.code + " " + color(diagnostic.flatMessage)]);
            else
                print.call(context, ["" + type + category + " TS" + diagnostic.code + " " + color(diagnostic.flatMessage)]);
        }
    });
}

function getOptionsOverrides(_a, tsConfigJson) {
    var useTsconfigDeclarationDir = _a.useTsconfigDeclarationDir;
    var overrides = {
        noEmitHelpers: false,
        importHelpers: true,
        noResolve: false,
        noEmit: false,
        outDir: process.cwd(),
        moduleResolution: tsModule.ModuleResolutionKind.NodeJs,
    };
    var declaration = _.get(tsConfigJson, "compilerOptions.declaration", false);
    if (!declaration)
        overrides.declarationDir = null;
    if (declaration && !useTsconfigDeclarationDir)
        overrides.declarationDir = process.cwd();
    return overrides;
}

function checkTsConfig(parsedConfig) {
    var module = parsedConfig.options.module;
    switch (module) {
        case tsModule.ModuleKind.ES2015:
        case tsModule.ModuleKind.ESNext:
            break;
        case undefined:
            throw new Error("Incompatible tsconfig option. Missing module option. This is incompatible with rollup, please use 'module: \"ES2015\"' or 'module: \"ESNext\"'.");
        default:
            throw new Error("Incompatible tsconfig option. Module resolves to '" + tsModule.ModuleKind[module] + "'. This is incompatible with rollup, please use 'module: \"ES2015\"' or 'module: \"ESNext\"'.");
    }
}

function getOptionsDefaults() {
    return {
        compilerOptions: {
            module: "ES2015",
        },
    };
}

function parseTsConfig(context, pluginOptions) {
    var fileName = tsModule.findConfigFile(process.cwd(), tsModule.sys.fileExists, pluginOptions.tsconfig);
    // if the value was provided, but no file, fail hard
    if (pluginOptions.tsconfig !== undefined && !fileName)
        throw new Error("failed to open '" + fileName + "'");
    var loadedConfig = {};
    var baseDir = process.cwd();
    var configFileName;
    if (fileName) {
        var text = tsModule.sys.readFile(fileName);
        if (text === undefined)
            throw new Error("failed to read '" + fileName + "'");
        var result = tsModule.parseConfigFileTextToJson(fileName, text);
        if (result.error !== undefined) {
            printDiagnostics(context, convertDiagnostic("config", [result.error]), _.get(result.config, "pretty", false));
            throw new Error("failed to parse '" + fileName + "'");
        }
        loadedConfig = result.config;
        baseDir = path.dirname(fileName);
        configFileName = fileName;
    }
    var mergedConfig = {};
    _.merge(mergedConfig, getOptionsDefaults(), pluginOptions.tsconfigDefaults, loadedConfig, pluginOptions.tsconfigOverride);
    var compilerOptionsOverride = getOptionsOverrides(pluginOptions, mergedConfig);
    var parsedTsConfig = tsModule.parseJsonConfigFileContent(mergedConfig, tsModule.sys, baseDir, compilerOptionsOverride, configFileName);
    checkTsConfig(parsedTsConfig);
    context.debug("built-in options overrides: " + JSON.stringify(compilerOptionsOverride, undefined, 4));
    context.debug("parsed tsconfig: " + JSON.stringify(parsedTsConfig, undefined, 4));
    return parsedTsConfig;
}

// The injected id for helpers.
var TSLIB = "tslib";
var tslibSource;
try {
    // tslint:disable-next-line:no-string-literal no-var-requires
    var tslibPath = require.resolve("tslib/" + require("tslib/package.json")["module"]);
    tslibSource = fs.readFileSync(tslibPath, "utf8");
}
catch (e) {
    console.warn("Error loading `tslib` helper library.");
    throw e;
}

function typescript(options) {
    // tslint:disable-next-line:no-var-requires
    var createFilter = require("rollup-pluginutils").createFilter;
    // tslint:enable-next-line:no-var-requires
    var watchMode = false;
    var generateRound = 0;
    var rollupOptions;
    var context;
    var filter;
    var parsedConfig;
    var servicesHost;
    var service;
    var noErrors = true;
    var declarations = {};
    var _cache;
    var cache = function () {
        if (!_cache)
            _cache = new TsCache(servicesHost, pluginOptions.cacheRoot, parsedConfig.options, rollupOptions, parsedConfig.fileNames, context);
        return _cache;
    };
    var pluginOptions = tslib_1.__assign({}, options);
    _.defaults(pluginOptions, {
        check: true,
        verbosity: VerbosityLevel.Warning,
        clean: false,
        cacheRoot: process.cwd() + "/.rpt2_cache",
        include: ["*.ts+(|x)", "**/*.ts+(|x)"],
        exclude: ["*.d.ts", "**/*.d.ts"],
        abortOnError: true,
        rollupCommonJSResolveHack: false,
        typescript: require("typescript"),
        tsconfig: undefined,
        useTsconfigDeclarationDir: false,
        tsconfigOverride: {},
        tsconfigDefaults: {},
    });
    setTypescriptModule(pluginOptions.typescript);
    return {
        name: "rpt2",
        options: function (config) {
            rollupOptions = tslib_1.__assign({}, config);
            context = new ConsoleContext(pluginOptions.verbosity, "rpt2: ");
            context.info("typescript version: " + tsModule.version);
            context.info("rollup-plugin-typescript2 version: 0.12.1");
            context.debug(function () { return "plugin options:\n" + JSON.stringify(pluginOptions, function (key, value) { return key === "typescript" ? "version " + value.version : value; }, 4); });
            context.debug(function () { return "rollup config:\n" + JSON.stringify(rollupOptions, undefined, 4); });
            watchMode = process.env.ROLLUP_WATCH === "true";
            if (watchMode)
                context.info("running in watch mode");
            parsedConfig = parseTsConfig(context, pluginOptions);
            if (parsedConfig.options.rootDirs) {
                var included_1 = _.chain(parsedConfig.options.rootDirs)
                    .flatMap(function (root) {
                    if (pluginOptions.include instanceof Array)
                        return pluginOptions.include.map(function (include) { return path.join(root, include); });
                    else
                        return path.join(root, pluginOptions.include);
                })
                    .uniq()
                    .value();
                var excluded_1 = _.chain(parsedConfig.options.rootDirs)
                    .flatMap(function (root) {
                    if (pluginOptions.exclude instanceof Array)
                        return pluginOptions.exclude.map(function (exclude) { return path.join(root, exclude); });
                    else
                        return path.join(root, pluginOptions.exclude);
                })
                    .uniq()
                    .value();
                filter = createFilter(included_1, excluded_1);
                context.debug(function () { return "included:\n" + JSON.stringify(included_1, undefined, 4); });
                context.debug(function () { return "excluded:\n" + JSON.stringify(excluded_1, undefined, 4); });
            }
            else {
                filter = createFilter(pluginOptions.include, pluginOptions.exclude);
                context.debug(function () { return "included:\n'" + JSON.stringify(pluginOptions.include, undefined, 4) + "'"; });
                context.debug(function () { return "excluded:\n'" + JSON.stringify(pluginOptions.exclude, undefined, 4) + "'"; });
            }
            servicesHost = new LanguageServiceHost(parsedConfig);
            service = tsModule.createLanguageService(servicesHost, tsModule.createDocumentRegistry());
            // printing compiler option errors
            if (pluginOptions.check)
                printDiagnostics(context, convertDiagnostic("options", service.getCompilerOptionsDiagnostics()), parsedConfig.options.pretty === true);
            if (pluginOptions.clean)
                cache().clean();
        },
        resolveId: function (importee, importer) {
            if (importee === TSLIB)
                return "\0" + TSLIB;
            if (!importer)
                return null;
            importer = importer.split("\\").join("/");
            // TODO: use module resolution cache
            var result = tsModule.nodeModuleNameResolver(importee, importer, parsedConfig.options, tsModule.sys);
            if (result.resolvedModule && result.resolvedModule.resolvedFileName) {
                if (filter(result.resolvedModule.resolvedFileName))
                    cache().setDependency(result.resolvedModule.resolvedFileName, importer);
                if (_.endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
                    return null;
                var resolved_1 = pluginOptions.rollupCommonJSResolveHack
                    ? resolve.sync(result.resolvedModule.resolvedFileName)
                    : result.resolvedModule.resolvedFileName;
                context.debug(function () { return safe.blue("resolving") + " '" + importee + "'"; });
                context.debug(function () { return "    to '" + resolved_1 + "'"; });
                return resolved_1;
            }
            return null;
        },
        load: function (id) {
            if (id === "\0" + TSLIB)
                return tslibSource;
            return undefined;
        },
        transform: function (code, id) {
            var _this = this;
            generateRound = 0; // in watch mode transform call resets generate count (used to avoid printing too many copies of the same error messages)
            if (!filter(id))
                return undefined;
            var contextWrapper = new RollupContext(pluginOptions.verbosity, pluginOptions.abortOnError, this, "rpt2: ");
            var snapshot = servicesHost.setSnapshot(id, code);
            // getting compiled file from cache or from ts
            var result = cache().getCompiled(id, snapshot, function () {
                var output = service.getEmitOutput(id);
                if (output.emitSkipped) {
                    noErrors = false;
                    // always checking on fatal errors, even if options.check is set to false
                    var diagnostics = _.concat(cache().getSyntacticDiagnostics(id, snapshot, function () {
                        return service.getSyntacticDiagnostics(id);
                    }), cache().getSemanticDiagnostics(id, snapshot, function () {
                        return service.getSemanticDiagnostics(id);
                    }));
                    printDiagnostics(contextWrapper, diagnostics, parsedConfig.options.pretty === true);
                    // since no output was generated, aborting compilation
                    cache().done();
                    if (_.isFunction(_this.error))
                        _this.error(safe.red("failed to transpile '" + id + "'"));
                }
                var transpiled = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".js") || _.endsWith(entry.name, ".jsx"); });
                var map = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".map"); });
                var dts = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".d.ts"); });
                return {
                    code: transpiled ? transpiled.text : undefined,
                    map: map ? JSON.parse(map.text) : { mappings: "" },
                    dts: dts,
                };
            });
            if (pluginOptions.check) {
                var diagnostics = _.concat(cache().getSyntacticDiagnostics(id, snapshot, function () {
                    return service.getSyntacticDiagnostics(id);
                }), cache().getSemanticDiagnostics(id, snapshot, function () {
                    return service.getSemanticDiagnostics(id);
                }));
                if (diagnostics.length > 0)
                    noErrors = false;
                printDiagnostics(contextWrapper, diagnostics, parsedConfig.options.pretty === true);
            }
            if (result && result.dts) {
                var key_1 = normalize(id);
                declarations[key_1] = result.dts;
                context.debug(function () { return safe.blue("generated declarations") + " for '" + key_1 + "'"; });
                result.dts = undefined;
            }
            return result;
        },
        ongenerate: function () {
            context.debug(function () { return "generating target " + (generateRound + 1); });
            if (watchMode && generateRound === 0) {
                cache().walkTree(function (id) {
                    if (!filter(id))
                        return;
                    var diagnostics = _.concat(convertDiagnostic("syntax", service.getSyntacticDiagnostics(id)), convertDiagnostic("semantic", service.getSemanticDiagnostics(id)));
                    printDiagnostics(context, diagnostics, parsedConfig.options.pretty === true);
                });
            }
            if (!watchMode && !noErrors)
                context.info(safe.yellow("there were errors or warnings."));
            cache().done();
            generateRound++;
        },
        onwrite: function (_a) {
            var dest = _a.dest, file = _a.file;
            if (parsedConfig.options.declaration) {
                _.each(parsedConfig.fileNames, function (name) {
                    var key = normalize(name);
                    if (_.has(declarations, key) || !filter(key))
                        return;
                    context.debug(function () { return "generating missed declarations for '" + key + "'"; });
                    var output = service.getEmitOutput(key, true);
                    var dts = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".d.ts"); });
                    if (dts)
                        declarations[key] = dts;
                });
                var bundleFile_1 = file ? file : dest; // rollup 0.48+ has 'file' https://github.com/rollup/rollup/issues/1479
                var baseDeclarationDir_1 = parsedConfig.options.outDir;
                _.each(declarations, function (_a, key) {
                    var name = _a.name, text = _a.text, writeByteOrderMark = _a.writeByteOrderMark;
                    var writeToPath;
                    // If for some reason no 'dest' property exists or if 'useTsconfigDeclarationDir' is given in the plugin options,
                    // use the path provided by Typescript's LanguageService.
                    if (!bundleFile_1 || pluginOptions.useTsconfigDeclarationDir)
                        writeToPath = name;
                    else {
                        // Otherwise, take the directory name from the path and make sure it is absolute.
                        var destDirname = path.dirname(bundleFile_1);
                        var destDirectory = path.isAbsolute(bundleFile_1) ? destDirname : path.join(process.cwd(), destDirname);
                        writeToPath = path.join(destDirectory, path.relative(baseDeclarationDir_1, name));
                    }
                    context.debug(function () { return safe.blue("writing declarations") + " for '" + key + "' to '" + writeToPath + "'"; });
                    // Write the declaration file to disk.
                    tsModule.sys.writeFile(writeToPath, text, writeByteOrderMark);
                });
            }
        },
    };
}

module.exports = typescript;
//# sourceMappingURL=rollup-plugin-typescript2.cjs.js.map
