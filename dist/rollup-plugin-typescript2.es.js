/* eslint-disable */
import { emptyDirSync, ensureFile, ensureFileSync, existsSync, move, readFileSync, readJsonSync, readdirSync, remove, writeJson, writeJsonSync } from 'fs-extra';
import * as fs from 'fs-extra';
import { ModuleKind, ScriptSnapshot, createDocumentRegistry, createLanguageService, flattenDiagnosticMessageText, getDefaultLibFilePath, nodeModuleNameResolver, parseConfigFileTextToJson, parseJsonConfigFileContent, sys } from 'typescript';
import * as ts from 'typescript';
import { defaults, each, endsWith, filter, find, has, isEqual, map, some } from 'lodash';
import * as _ from 'lodash';
import { Graph, alg } from 'graphlib';
import * as graph from 'graphlib';
import { sha1 } from 'object-hash';
import * as hash from 'object-hash';
import { createFilter } from 'rollup-pluginutils';
import { dirname, sep } from 'path';
import * as path from 'path';
import { red, yellow } from 'colors/safe';
import * as colors from 'colors/safe';

const __assign = Object.assign || function (target) {
    for (var source, i = 1; i < arguments.length; i++) {
        source = arguments[i];
        for (var prop in source) {
            if (Object.prototype.hasOwnProperty.call(source, prop)) {
                target[prop] = source[prop];
            }
        }
    }
    return target;
};

var VerbosityLevel;
(function (VerbosityLevel) {
    VerbosityLevel[VerbosityLevel["Error"] = 0] = "Error";
    VerbosityLevel[VerbosityLevel["Warning"] = 1] = "Warning";
    VerbosityLevel[VerbosityLevel["Info"] = 2] = "Info";
    VerbosityLevel[VerbosityLevel["Debug"] = 3] = "Debug";
})(VerbosityLevel || (VerbosityLevel = {}));
var ConsoleContext = (function () {
    function ConsoleContext(verbosity, prefix) {
        if (prefix === void 0) { prefix = ""; }
        this.verbosity = verbosity;
        this.prefix = prefix;
    }
    ConsoleContext.prototype.warn = function (message) {
        if (this.verbosity < VerbosityLevel.Warning)
            return;
        console.log("" + this.prefix + message);
    };
    ConsoleContext.prototype.error = function (message) {
        if (this.verbosity < VerbosityLevel.Error)
            return;
        console.log("" + this.prefix + message);
    };
    ConsoleContext.prototype.info = function (message) {
        if (this.verbosity < VerbosityLevel.Info)
            return;
        console.log("" + this.prefix + message);
    };
    ConsoleContext.prototype.debug = function (message) {
        if (this.verbosity < VerbosityLevel.Debug)
            return;
        console.log("" + this.prefix + message);
    };
    return ConsoleContext;
}());

var LanguageServiceHost = (function () {
    function LanguageServiceHost(parsedConfig) {
        this.parsedConfig = parsedConfig;
        this.cwd = process.cwd();
        this.snapshots = {};
    }
    LanguageServiceHost.prototype.setSnapshot = function (fileName, data) {
        var snapshot = ScriptSnapshot.fromString(data);
        this.snapshots[fileName] = snapshot;
        return snapshot;
    };
    LanguageServiceHost.prototype.getScriptSnapshot = function (fileName) {
        if (has(this.snapshots, fileName))
            return this.snapshots[fileName];
        if (existsSync(fileName)) {
            this.snapshots[fileName] = ScriptSnapshot.fromString(sys.readFile(fileName));
            return this.snapshots[fileName];
        }
        return undefined;
    };
    LanguageServiceHost.prototype.getCurrentDirectory = function () {
        return this.cwd;
    };
    LanguageServiceHost.prototype.getScriptVersion = function (_fileName) {
        return "0";
    };
    LanguageServiceHost.prototype.getScriptFileNames = function () {
        return this.parsedConfig.fileNames;
    };
    LanguageServiceHost.prototype.getCompilationSettings = function () {
        return this.parsedConfig.options;
    };
    LanguageServiceHost.prototype.getDefaultLibFileName = function (opts) {
        return getDefaultLibFilePath(opts);
    };
    return LanguageServiceHost;
}());

/**
 * Saves data in new cache folder or reads it from old one.
 * Avoids perpetually growing cache and situations when things need to consider changed and then reverted data to be changed.
 */
var RollingCache = (function () {
    /**
     * @param cacheRoot: root folder for the cache
     * @param checkNewCache: whether to also look in new cache when reading from cache
     */
    function RollingCache(cacheRoot, checkNewCache) {
        this.cacheRoot = cacheRoot;
        this.checkNewCache = checkNewCache;
        this.oldCacheRoot = this.cacheRoot + "/cache";
        this.newCacheRoot = this.cacheRoot + "/cache_";
        emptyDirSync(this.newCacheRoot);
    }
    /**
     * @returns true if name exist in old cache (or either old of new cache if checkNewCache is true)
     */
    RollingCache.prototype.exists = function (name) {
        if (this.checkNewCache && existsSync(this.newCacheRoot + "/" + name))
            return true;
        return existsSync(this.oldCacheRoot + "/" + name);
    };
    /**
     * @returns true if old cache contains all names and nothing more
     */
    RollingCache.prototype.match = function (names) {
        if (!existsSync(this.oldCacheRoot))
            return names.length === 0; // empty folder matches
        return isEqual(readdirSync(this.oldCacheRoot).sort(), names.sort());
    };
    /**
     * @returns data for name, must exist in old cache (or either old of new cache if checkNewCache is true)
     */
    RollingCache.prototype.read = function (name) {
        if (this.checkNewCache && existsSync(this.newCacheRoot + "/" + name))
            return readJsonSync(this.newCacheRoot + "/" + name, "utf8");
        return readJsonSync(this.oldCacheRoot + "/" + name, "utf8");
    };
    RollingCache.prototype.write = function (name, data) {
        if (data === undefined)
            return;
        if (this.checkNewCache)
            writeJsonSync(this.newCacheRoot + "/" + name, data);
        else
            writeJson(this.newCacheRoot + "/" + name, data, { encoding: "utf8" }, function () {  });
    };
    RollingCache.prototype.touch = function (name) {
        if (this.checkNewCache)
            ensureFileSync(this.newCacheRoot + "/" + name);
        else
            ensureFile(this.newCacheRoot + "/" + name, function () {  });
    };
    /**
     * clears old cache and moves new in its place
     */
    RollingCache.prototype.roll = function () {
        var _this = this;
        remove(this.oldCacheRoot, function () {
            move(_this.newCacheRoot, _this.oldCacheRoot, function () {  });
        });
    };
    return RollingCache;
}());

var Cache = (function () {
    function Cache(host, cache, options, rootFilenames, context) {
        var _this = this;
        this.host = host;
        this.options = options;
        this.context = context;
        this.cacheVersion = "1";
        this.ambientTypesDirty = false;
        this.cacheDir = cache + "/" + sha1({ version: this.cacheVersion, rootFilenames: rootFilenames, options: this.options });
        this.codeCache = new RollingCache(this.cacheDir + "/code", true);
        this.typesCache = new RollingCache(this.cacheDir + "/types", false);
        this.diagnosticsCache = new RollingCache(this.cacheDir + "/diagnostics", false);
        this.dependencyTree = new Graph({ directed: true });
        this.dependencyTree.setDefaultNodeLabel(function (_node) { return { dirty: false }; });
        this.ambientTypes = filter(rootFilenames, function (file) { return endsWith(file, ".d.ts"); })
            .map(function (id) { return { id: id, snapshot: _this.host.getScriptSnapshot(id) }; });
    }
    Cache.prototype.clean = function () {
        this.context.info("cleaning cache: " + this.cacheDir);
        emptyDirSync(this.cacheDir);
    };
    Cache.prototype.walkTree = function (cb) {
        var acyclic = alg.isAcyclic(this.dependencyTree);
        if (acyclic) {
            each(alg.topsort(this.dependencyTree), function (id) { return cb(id); });
            return;
        }
        this.context.info("import tree has cycles");
        each(this.dependencyTree.nodes(), function (id) { return cb(id); });
    };
    Cache.prototype.setDependency = function (importee, importer) {
        // importee -> importer
        this.context.debug(importee + " -> " + importer);
        this.dependencyTree.setEdge(importer, importee);
    };
    Cache.prototype.compileDone = function () {
        var _this = this;
        var typeNames = filter(this.ambientTypes, function (snaphot) { return snaphot.snapshot !== undefined; })
            .map(function (snaphot) { return _this.makeName(snaphot.id, snaphot.snapshot); });
        // types dirty if any d.ts changed, added or removed
        this.ambientTypesDirty = !this.typesCache.match(typeNames);
        if (this.ambientTypesDirty)
            this.context.info("ambient types changed, redoing all diagnostics");
        each(typeNames, function (name) { return _this.typesCache.touch(name); });
    };
    Cache.prototype.diagnosticsDone = function () {
        this.codeCache.roll();
        this.diagnosticsCache.roll();
        this.typesCache.roll();
    };
    Cache.prototype.getCompiled = function (id, snapshot, transform) {
        var name = this.makeName(id, snapshot);
        if (!this.codeCache.exists(name) || this.isDirty(id, snapshot, false)) {
            this.context.debug("fresh transpile for: " + id);
            var data_1 = transform();
            this.codeCache.write(name, data_1);
            this.markAsDirty(id, snapshot);
            return data_1;
        }
        this.context.debug("old transpile for: " + id);
        var data = this.codeCache.read(name);
        this.codeCache.write(name, data);
        return data;
    };
    Cache.prototype.getDiagnostics = function (id, snapshot, check) {
        var name = this.makeName(id, snapshot);
        if (!this.diagnosticsCache.exists(name) || this.isDirty(id, snapshot, true)) {
            this.context.debug("fresh diagnostics for: " + id);
            var data_2 = this.convert(check());
            this.diagnosticsCache.write(name, data_2);
            this.markAsDirty(id, snapshot);
            return data_2;
        }
        this.context.debug("old diagnostics for: " + id);
        var data = this.diagnosticsCache.read(name);
        this.diagnosticsCache.write(name, data);
        return data;
    };
    Cache.prototype.markAsDirty = function (id, _snapshot) {
        this.context.debug("changed: " + id);
        this.dependencyTree.setNode(id, { dirty: true });
    };
    // returns true if node or any of its imports or any of global types changed
    Cache.prototype.isDirty = function (id, _snapshot, checkImports) {
        var _this = this;
        var label = this.dependencyTree.node(id);
        if (!label)
            return false;
        if (!checkImports || label.dirty)
            return label.dirty;
        if (this.ambientTypesDirty)
            return true;
        var dependencies = alg.dijkstra(this.dependencyTree, id);
        return some(dependencies, function (dependency, node) {
            if (!node || dependency.distance === Infinity)
                return false;
            var l = _this.dependencyTree.node(node);
            var dirty = l === undefined ? true : l.dirty;
            if (dirty)
                _this.context.debug("import changed: " + id + " -> " + node);
            return dirty;
        });
    };
    Cache.prototype.makeName = function (id, snapshot) {
        var data = snapshot.getText(0, snapshot.getLength());
        return sha1({ data: data, id: id });
    };
    Cache.prototype.convert = function (data) {
        return map(data, function (diagnostic) {
            var entry = {
                flatMessage: flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
            };
            if (diagnostic.file) {
                var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
                entry.fileLine = diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + ")";
            }
            return entry;
        });
    };
    return Cache;
}());

function getOptionsOverrides() {
    return {
        module: ModuleKind.ES2015,
        sourceMap: true,
        noEmitHelpers: true,
        importHelpers: true,
        noResolve: false,
    };
}
// Gratefully lifted from 'look-up', due to problems using it directly:
//   https://github.com/jonschlinkert/look-up/blob/master/index.js
//   MIT Licenced
function findFile(cwd, filename) {
    var fp = cwd ? (cwd + "/" + filename) : filename;
    if (existsSync(fp))
        return fp;
    var segs = cwd.split(sep);
    var len = segs.length;
    while (len--) {
        cwd = segs.slice(0, len).join("/");
        fp = cwd + "/" + filename;
        if (existsSync(fp))
            return fp;
    }
    return null;
}
// The injected id for helpers.
var TSLIB = "tslib";
var tslibSource;
try {
    // tslint:disable-next-line:no-string-literal no-var-requires
    var tslibPath = require.resolve("tslib/" + require("tslib/package.json")["module"]);
    tslibSource = readFileSync(tslibPath, "utf8");
}
catch (e) {
    console.warn("Error loading `tslib` helper library.");
    throw e;
}
function parseTsConfig() {
    var fileName = findFile(process.cwd(), "tsconfig.json");
    if (!fileName)
        throw new Error("couldn't find 'tsconfig.json' in " + process.cwd());
    var text = sys.readFile(fileName);
    var result = parseConfigFileTextToJson(fileName, text);
    var configParseResult = parseJsonConfigFileContent(result.config, sys, dirname(fileName), getOptionsOverrides(), fileName);
    return configParseResult;
}
function printDiagnostics(context, diagnostics) {
    each(diagnostics, function (diagnostic) {
        if (diagnostic.fileLine)
            context.warn(diagnostic.fileLine + ": " + yellow(diagnostic.flatMessage));
        else
            context.warn(yellow(diagnostic.flatMessage));
    });
}

function typescript(options) {
    options = __assign({}, options);
    defaults(options, {
        check: true,
        verbose: VerbosityLevel.Info,
        clean: false,
        cacheRoot: process.cwd() + "/.rts2_cache",
        include: ["*.ts+(|x)", "**/*.ts+(|x)"],
        exclude: ["*.d.ts", "**/*.d.ts"],
    });
    var filter$$1 = createFilter(options.include, options.exclude);
    var parsedConfig = parseTsConfig();
    var servicesHost = new LanguageServiceHost(parsedConfig);
    var services = createLanguageService(servicesHost, createDocumentRegistry());
    var context = new ConsoleContext(options.verbose, "");
    var cache = new Cache(servicesHost, options.cacheRoot, parsedConfig.options, parsedConfig.fileNames, context);
    if (options.clean)
        cache.clean();
    return {
        resolveId: function (importee, importer) {
            if (importee === TSLIB)
                return "\0" + TSLIB;
            if (!importer)
                return null;
            importer = importer.split("\\").join("/");
            var result = nodeModuleNameResolver(importee, importer, parsedConfig.options, sys);
            if (result.resolvedModule && result.resolvedModule.resolvedFileName) {
                if (filter$$1(result.resolvedModule.resolvedFileName))
                    cache.setDependency(result.resolvedModule.resolvedFileName, importer);
                if (endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
                    return null;
                return result.resolvedModule.resolvedFileName;
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
            if (!filter$$1(id))
                return undefined;
            var snapshot = servicesHost.setSnapshot(id, code);
            var result = cache.getCompiled(id, snapshot, function () {
                var output = services.getEmitOutput(id);
                if (output.emitSkipped)
                    _this.error({ message: red("failed to transpile " + id) });
                var transpiled = find(output.outputFiles, function (entry) { return endsWith(entry.name, ".js"); });
                var map$$1 = find(output.outputFiles, function (entry) { return endsWith(entry.name, ".map"); });
                return {
                    code: transpiled ? transpiled.text : undefined,
                    map: map$$1 ? JSON.parse(map$$1.text) : { mappings: "" },
                };
            });
            return result;
        },
        outro: function () {
            cache.compileDone();
            if (options.check) {
                cache.walkTree(function (id) {
                    var snapshot = servicesHost.getScriptSnapshot(id);
                    if (!snapshot) {
                        context.error(red("failed lo load snapshot for " + id));
                        return;
                    }
                    var diagnostics = cache.getDiagnostics(id, snapshot, function () {
                        return services
                            .getCompilerOptionsDiagnostics()
                            .concat(services.getSyntacticDiagnostics(id))
                            .concat(services.getSemanticDiagnostics(id));
                    });
                    printDiagnostics(context, diagnostics);
                });
            }
            cache.diagnosticsDone();
        },
    };
}

export default typescript;
