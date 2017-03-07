/* eslint-disable */
'use strict';

var fs = require('fs-extra');
var ts = require('typescript');
var _ = require('lodash');
var graph = require('graphlib');
var hash = require('object-hash');
var path = require('path');
var colors = require('colors/safe');
var resolve = require('resolve');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */



var __assign = Object.assign || function __assign(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }
    return t;
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

var RollupContext = (function () {
    function RollupContext(verbosity, bail, context, prefix) {
        if (prefix === void 0) { prefix = ""; }
        this.verbosity = verbosity;
        this.bail = bail;
        this.context = context;
        this.prefix = prefix;
    }
    RollupContext.prototype.warn = function (message) {
        if (this.verbosity < VerbosityLevel.Warning)
            return;
        this.context.warn("" + this.prefix + message);
    };
    RollupContext.prototype.error = function (message) {
        if (this.verbosity < VerbosityLevel.Error)
            return;
        if (this.bail)
            this.context.error("" + this.prefix + message);
        else
            this.context.warn("" + this.prefix + message);
    };
    RollupContext.prototype.info = function (message) {
        if (this.verbosity < VerbosityLevel.Info)
            return;
        console.log("" + this.prefix + message);
    };
    RollupContext.prototype.debug = function (message) {
        if (this.verbosity < VerbosityLevel.Debug)
            return;
        console.log("" + this.prefix + message);
    };
    return RollupContext;
}());

var LanguageServiceHost = (function () {
    function LanguageServiceHost(parsedConfig) {
        this.parsedConfig = parsedConfig;
        this.cwd = process.cwd();
        this.snapshots = {};
    }
    LanguageServiceHost.prototype.setSnapshot = function (fileName, data) {
        var snapshot = ts.ScriptSnapshot.fromString(data);
        this.snapshots[fileName] = snapshot;
        return snapshot;
    };
    LanguageServiceHost.prototype.getScriptSnapshot = function (fileName) {
        if (_.has(this.snapshots, fileName))
            return this.snapshots[fileName];
        if (fs.existsSync(fileName)) {
            this.snapshots[fileName] = ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName));
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
        return ts.getDefaultLibFilePath(opts);
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
        fs.emptyDirSync(this.newCacheRoot);
    }
    /**
     * @returns true if name exist in old cache (or either old of new cache if checkNewCache is true)
     */
    RollingCache.prototype.exists = function (name) {
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
        if (!fs.existsSync(this.oldCacheRoot))
            return names.length === 0; // empty folder matches
        return _.isEqual(fs.readdirSync(this.oldCacheRoot).sort(), names.sort());
    };
    /**
     * @returns data for name, must exist in old cache (or either old of new cache if checkNewCache is true)
     */
    RollingCache.prototype.read = function (name) {
        if (this.checkNewCache && fs.existsSync(this.newCacheRoot + "/" + name))
            return fs.readJsonSync(this.newCacheRoot + "/" + name, "utf8");
        return fs.readJsonSync(this.oldCacheRoot + "/" + name, "utf8");
    };
    RollingCache.prototype.write = function (name, data) {
        if (data === undefined)
            return;
        if (this.checkNewCache)
            fs.writeJsonSync(this.newCacheRoot + "/" + name, data);
        else
            fs.writeJson(this.newCacheRoot + "/" + name, data, { encoding: "utf8" }, function () {  });
    };
    RollingCache.prototype.touch = function (name) {
        if (this.checkNewCache)
            fs.ensureFileSync(this.newCacheRoot + "/" + name);
        else
            fs.ensureFile(this.newCacheRoot + "/" + name, function () {  });
    };
    /**
     * clears old cache and moves new in its place
     */
    RollingCache.prototype.roll = function () {
        var _this = this;
        fs.remove(this.oldCacheRoot, function () {
            fs.move(_this.newCacheRoot, _this.oldCacheRoot, function () {  });
        });
    };
    return RollingCache;
}());

function convertDiagnostic(data) {
    return _.map(data, function (diagnostic) {
        var entry = {
            flatMessage: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
            category: diagnostic.category,
        };
        if (diagnostic.file) {
            var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
            entry.fileLine = diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + ")";
        }
        return entry;
    });
}
var Cache = (function () {
    function Cache(host, cache, options, rootFilenames, context) {
        var _this = this;
        this.host = host;
        this.options = options;
        this.context = context;
        this.cacheVersion = "2";
        this.ambientTypesDirty = false;
        this.cacheDir = cache + "/" + hash.sha1({
            version: this.cacheVersion,
            rootFilenames: rootFilenames,
            options: this.options,
            tsVersion: ts.version,
        });
        this.dependencyTree = new graph.Graph({ directed: true });
        this.dependencyTree.setDefaultNodeLabel(function (_node) { return { dirty: false }; });
        var automaticTypes = _.map(ts.getAutomaticTypeDirectiveNames(options, ts.sys), function (entry) { return ts.resolveTypeReferenceDirective(entry, undefined, options, ts.sys); })
            .filter(function (entry) { return entry.resolvedTypeReferenceDirective && entry.resolvedTypeReferenceDirective.resolvedFileName; })
            .map(function (entry) { return entry.resolvedTypeReferenceDirective.resolvedFileName; });
        this.ambientTypes = _.filter(rootFilenames, function (file) { return _.endsWith(file, ".d.ts"); })
            .concat(automaticTypes)
            .map(function (id) { return { id: id, snapshot: _this.host.getScriptSnapshot(id) }; });
        this.init();
    }
    Cache.prototype.clean = function () {
        this.context.info("cleaning cache: " + this.cacheDir);
        fs.emptyDirSync(this.cacheDir);
        this.init();
    };
    Cache.prototype.walkTree = function (cb) {
        var acyclic = graph.alg.isAcyclic(this.dependencyTree);
        if (acyclic) {
            _.each(graph.alg.topsort(this.dependencyTree), function (id) { return cb(id); });
            return;
        }
        this.context.info("import tree has cycles");
        _.each(this.dependencyTree.nodes(), function (id) { return cb(id); });
    };
    Cache.prototype.setDependency = function (importee, importer) {
        // importee -> importer
        this.context.debug("" + importee);
        this.context.debug("    imported by " + importer);
        this.dependencyTree.setEdge(importer, importee);
    };
    Cache.prototype.compileDone = function () {
        var _this = this;
        this.context.debug("Ambient types:");
        var typeNames = _.filter(this.ambientTypes, function (snapshot) { return snapshot.snapshot !== undefined; })
            .map(function (snapshot) {
            _this.context.debug("    " + snapshot.id);
            return _this.makeName(snapshot.id, snapshot.snapshot);
        });
        // types dirty if any d.ts changed, added or removed
        this.ambientTypesDirty = !this.typesCache.match(typeNames);
        if (this.ambientTypesDirty)
            this.context.info("ambient types changed, redoing all diagnostics");
        _.each(typeNames, function (name) { return _this.typesCache.touch(name); });
    };
    Cache.prototype.diagnosticsDone = function () {
        this.codeCache.roll();
        this.semanticDiagnosticsCache.roll();
        this.syntacticDiagnosticsCache.roll();
        this.typesCache.roll();
    };
    Cache.prototype.getCompiled = function (id, snapshot, transform) {
        var name = this.makeName(id, snapshot);
        this.context.debug("transpiling '" + id + "'");
        this.context.debug("    cache: '" + this.codeCache.path(name) + "'");
        if (!this.codeCache.exists(name) || this.isDirty(id, snapshot, false)) {
            this.context.debug("    cache miss");
            var data_1 = transform();
            this.codeCache.write(name, data_1);
            this.markAsDirty(id, snapshot);
            return data_1;
        }
        this.context.debug("    cache hit");
        var data = this.codeCache.read(name);
        this.codeCache.write(name, data);
        return data;
    };
    Cache.prototype.getSyntacticDiagnostics = function (id, snapshot, check) {
        return this.getDiagnostics(this.syntacticDiagnosticsCache, id, snapshot, check);
    };
    Cache.prototype.getSemanticDiagnostics = function (id, snapshot, check) {
        return this.getDiagnostics(this.semanticDiagnosticsCache, id, snapshot, check);
    };
    Cache.prototype.getDiagnostics = function (cache, id, snapshot, check) {
        var name = this.makeName(id, snapshot);
        this.context.debug("diagnostics for '" + id + "'");
        this.context.debug("    cache: '" + cache.path(name) + "'");
        if (!cache.exists(name) || this.isDirty(id, snapshot, true)) {
            this.context.debug("    cache miss");
            var data_2 = convertDiagnostic(check());
            cache.write(name, data_2);
            this.markAsDirty(id, snapshot);
            return data_2;
        }
        this.context.debug("    cache hit");
        var data = cache.read(name);
        cache.write(name, data);
        return data;
    };
    Cache.prototype.init = function () {
        this.codeCache = new RollingCache(this.cacheDir + "/code", true);
        this.typesCache = new RollingCache(this.cacheDir + "/types", false);
        this.syntacticDiagnosticsCache = new RollingCache(this.cacheDir + "/syntacticDiagnostics", false);
        this.semanticDiagnosticsCache = new RollingCache(this.cacheDir + "/semanticDiagnostics", false);
    };
    Cache.prototype.markAsDirty = function (id, _snapshot) {
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
        var dependencies = graph.alg.dijkstra(this.dependencyTree, id);
        return _.some(dependencies, function (dependency, node) {
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
        return hash.sha1({ data: data, id: id });
    };
    return Cache;
}());

// tslint:disable-next-line:no-var-requires
var createFilter = require("rollup-pluginutils").createFilter;
function getOptionsOverrides() {
    return {
        module: ts.ModuleKind.ES2015,
        sourceMap: true,
        noEmitHelpers: true,
        importHelpers: true,
        noResolve: false,
    };
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
function parseTsConfig(context) {
    var fileName = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
    if (!fileName)
        throw new Error("couldn't find 'tsconfig.json' in " + process.cwd());
    var text = ts.sys.readFile(fileName);
    var result = ts.parseConfigFileTextToJson(fileName, text);
    if (result.error) {
        printDiagnostics(context, convertDiagnostic([result.error]));
        throw new Error("failed to parse " + fileName);
    }
    var configParseResult = ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(fileName), getOptionsOverrides(), fileName);
    return configParseResult;
}
function printDiagnostics(context, diagnostics) {
    _.each(diagnostics, function (diagnostic) {
        var print;
        var color;
        switch (diagnostic.category) {
            case ts.DiagnosticCategory.Message:
                print = context.info;
                color = colors.white;
                break;
            case ts.DiagnosticCategory.Error:
                print = context.error;
                color = colors.red;
                break;
            case ts.DiagnosticCategory.Warning:
            default:
                print = context.warn;
                color = colors.yellow;
                break;
        }
        if (diagnostic.fileLine)
            print.call(context, [diagnostic.fileLine + ": " + color(diagnostic.flatMessage)]);
        else
            print.call(context, [color(diagnostic.flatMessage)]);
    });
}

function typescript(options) {
    options = __assign({}, options);
    _.defaults(options, {
        check: true,
        verbosity: VerbosityLevel.Info,
        clean: false,
        cacheRoot: process.cwd() + "/.rpt2_cache",
        include: ["*.ts+(|x)", "**/*.ts+(|x)"],
        exclude: ["*.d.ts", "**/*.d.ts"],
        abortOnError: true,
    });
    var context = new ConsoleContext(options.verbosity, "rpt2: ");
    var filter$$1 = createFilter(options.include, options.exclude);
    var parsedConfig = parseTsConfig(context);
    var servicesHost = new LanguageServiceHost(parsedConfig);
    var services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
    var cache = new Cache(servicesHost, options.cacheRoot, parsedConfig.options, parsedConfig.fileNames, context);
    if (options.clean)
        cache.clean();
    // printing compiler option errors
    if (options.check)
        printDiagnostics(context, convertDiagnostic(services.getCompilerOptionsDiagnostics()));
    return {
        resolveId: function (importee, importer) {
            if (importee === TSLIB)
                return "\0" + TSLIB;
            if (!importer)
                return null;
            importer = importer.split("\\").join("/");
            var result = ts.nodeModuleNameResolver(importee, importer, parsedConfig.options, ts.sys);
            if (result.resolvedModule && result.resolvedModule.resolvedFileName) {
                if (filter$$1(result.resolvedModule.resolvedFileName))
                    cache.setDependency(result.resolvedModule.resolvedFileName, importer);
                if (_.endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
                    return null;
                var resolved = options.rollupCommonJSResolveHack
                    ? resolve.sync(result.resolvedModule.resolvedFileName)
                    : result.resolvedModule.resolvedFileName;
                context.debug("resolving " + importee + " to " + resolved);
                return resolved;
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
            var contextWrapper = new RollupContext(options.verbosity, options.abortOnError, this, "rpt2: ");
            var snapshot = servicesHost.setSnapshot(id, code);
            // getting compiled file from cache of from ts
            var result = cache.getCompiled(id, snapshot, function () {
                var output = services.getEmitOutput(id);
                if (output.emitSkipped) {
                    if (options.check) {
                        var diagnostics = cache.getSyntacticDiagnostics(id, snapshot, function () {
                            return services.getSyntacticDiagnostics(id);
                        });
                        printDiagnostics(contextWrapper, diagnostics);
                    }
                    // if no output was generated, aborting compilation
                    _this.error(colors.red("failed to transpile " + id));
                }
                var transpiled = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".js"); });
                var map$$1 = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".map"); });
                return {
                    code: transpiled ? transpiled.text : undefined,
                    map: map$$1 ? JSON.parse(map$$1.text) : { mappings: "" },
                };
            });
            // printing syntactic errors
            if (options.check) {
                var diagnostics = cache.getSyntacticDiagnostics(id, snapshot, function () {
                    return services.getSyntacticDiagnostics(id);
                });
                printDiagnostics(contextWrapper, diagnostics);
            }
            return result;
        },
        outro: function () {
            context.debug("outro");
            cache.compileDone();
            // printing semantic errors
            if (options.check) {
                cache.walkTree(function (id) {
                    var snapshot = servicesHost.getScriptSnapshot(id);
                    if (!snapshot) {
                        context.error(colors.red("failed lo load snapshot for " + id));
                        return;
                    }
                    var diagnostics = cache.getSemanticDiagnostics(id, snapshot, function () {
                        return services.getSemanticDiagnostics(id);
                    });
                    printDiagnostics(context, diagnostics);
                });
            }
            cache.diagnosticsDone();
        },
    };
}

module.exports = typescript;
