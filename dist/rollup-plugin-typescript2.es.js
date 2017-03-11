/* eslint-disable */
import { emptyDirSync, ensureFile, ensureFileSync, existsSync, move, readFileSync, readJsonSync, readdirSync, remove, writeJson, writeJsonSync } from 'fs-extra';
import * as fs from 'fs-extra';
import { DiagnosticCategory, ModuleKind, ScriptSnapshot, createDocumentRegistry, createLanguageService, findConfigFile, flattenDiagnosticMessageText, getAutomaticTypeDirectiveNames, getDefaultLibFilePath, nodeModuleNameResolver, parseConfigFileTextToJson, parseJsonConfigFileContent, resolveTypeReferenceDirective, sys, version } from 'typescript';
import * as ts from 'typescript';
import { defaults, each, endsWith, filter, find, has, isEqual, map, some } from 'lodash';
import * as _ from 'lodash';
import { Graph, alg } from 'graphlib';
import * as graph from 'graphlib';
import { sha1 } from 'object-hash';
import * as hash from 'object-hash';
import { blue, green, red, white, yellow } from 'colors/safe';
import * as colors from 'colors/safe';
import { dirname } from 'path';
import * as path from 'path';
import { sync } from 'resolve';
import * as resolve from 'resolve';

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
        this.versions = {};
    }
    LanguageServiceHost.prototype.setSnapshot = function (fileName, data) {
        var snapshot = ScriptSnapshot.fromString(data);
        this.snapshots[fileName] = snapshot;
        this.versions[fileName] = (this.versions[fileName] || 0) + 1;
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
        return (this.versions[_fileName] || 0).toString();
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
    RollingCache.prototype.path = function (name) {
        return this.oldCacheRoot + "/" + name;
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

function convertDiagnostic(data) {
    return map(data, function (diagnostic) {
        var entry = {
            flatMessage: flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
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
        this.cacheDir = cache + "/" + sha1({
            version: this.cacheVersion,
            rootFilenames: rootFilenames,
            options: this.options,
            tsVersion: version,
        });
        this.dependencyTree = new Graph({ directed: true });
        this.dependencyTree.setDefaultNodeLabel(function (_node) { return { dirty: false }; });
        var automaticTypes = map(getAutomaticTypeDirectiveNames(options, sys), function (entry) { return resolveTypeReferenceDirective(entry, undefined, options, sys); })
            .filter(function (entry) { return entry.resolvedTypeReferenceDirective && entry.resolvedTypeReferenceDirective.resolvedFileName; })
            .map(function (entry) { return entry.resolvedTypeReferenceDirective.resolvedFileName; });
        this.ambientTypes = filter(rootFilenames, function (file) { return endsWith(file, ".d.ts"); })
            .concat(automaticTypes)
            .map(function (id) { return { id: id, snapshot: _this.host.getScriptSnapshot(id) }; });
        this.init();
        this.checkAmbientTypes();
    }
    Cache.prototype.clean = function () {
        this.context.info(blue("cleaning cache: " + this.cacheDir));
        emptyDirSync(this.cacheDir);
        this.init();
    };
    Cache.prototype.setDependency = function (importee, importer) {
        // importee -> importer
        this.context.debug(blue("dependency") + " '" + importee + "'");
        this.context.debug("    imported by '" + importer + "'");
        this.dependencyTree.setEdge(importer, importee);
    };
    Cache.prototype.done = function () {
        this.context.info(blue("rolling caches"));
        this.codeCache.roll();
        this.semanticDiagnosticsCache.roll();
        this.syntacticDiagnosticsCache.roll();
        this.typesCache.roll();
    };
    Cache.prototype.getCompiled = function (id, snapshot, transform) {
        var name = this.makeName(id, snapshot);
        this.context.info(blue("transpiling") + " '" + id + "'");
        this.context.debug("    cache: '" + this.codeCache.path(name) + "'");
        if (!this.codeCache.exists(name) || this.isDirty(id, snapshot, false)) {
            this.context.debug(yellow("    cache miss"));
            var data_1 = transform();
            this.codeCache.write(name, data_1);
            this.markAsDirty(id, snapshot);
            return data_1;
        }
        this.context.debug(green("    cache hit"));
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
    Cache.prototype.checkAmbientTypes = function () {
        var _this = this;
        this.context.debug(blue("Ambient types:"));
        var typeNames = filter(this.ambientTypes, function (snapshot) { return snapshot.snapshot !== undefined; })
            .map(function (snapshot) {
            _this.context.debug("    " + snapshot.id);
            return _this.makeName(snapshot.id, snapshot.snapshot);
        });
        // types dirty if any d.ts changed, added or removed
        this.ambientTypesDirty = !this.typesCache.match(typeNames);
        if (this.ambientTypesDirty)
            this.context.info(yellow("ambient types changed, redoing all semantic diagnostics"));
        each(typeNames, function (name) { return _this.typesCache.touch(name); });
    };
    Cache.prototype.getDiagnostics = function (cache, id, snapshot, check) {
        var name = this.makeName(id, snapshot);
        this.context.debug("    cache: '" + cache.path(name) + "'");
        if (!cache.exists(name) || this.isDirty(id, snapshot, true)) {
            this.context.debug(yellow("    cache miss"));
            var data_2 = convertDiagnostic(check());
            cache.write(name, data_2);
            this.markAsDirty(id, snapshot);
            return data_2;
        }
        this.context.debug(green("    cache hit"));
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
        var dependencies = alg.dijkstra(this.dependencyTree, id);
        return some(dependencies, function (dependency, node) {
            if (!node || dependency.distance === Infinity)
                return false;
            var l = _this.dependencyTree.node(node);
            var dirty = l === undefined ? true : l.dirty;
            if (dirty)
                _this.context.debug("    import changed: " + node);
            return dirty;
        });
    };
    Cache.prototype.makeName = function (id, snapshot) {
        var data = snapshot.getText(0, snapshot.getLength());
        return sha1({ data: data, id: id });
    };
    return Cache;
}());

// tslint:disable-next-line:no-var-requires
var createFilter = require("rollup-pluginutils").createFilter;
function getOptionsOverrides() {
    return {
        module: ModuleKind.ES2015,
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
    tslibSource = readFileSync(tslibPath, "utf8");
}
catch (e) {
    console.warn("Error loading `tslib` helper library.");
    throw e;
}
function parseTsConfig(context) {
    var fileName = findConfigFile(process.cwd(), sys.fileExists, "tsconfig.json");
    if (!fileName)
        throw new Error("couldn't find 'tsconfig.json' in " + process.cwd());
    var text = sys.readFile(fileName);
    var result = parseConfigFileTextToJson(fileName, text);
    if (result.error) {
        printDiagnostics(context, convertDiagnostic([result.error]));
        throw new Error("failed to parse " + fileName);
    }
    var configParseResult = parseJsonConfigFileContent(result.config, sys, dirname(fileName), getOptionsOverrides(), fileName);
    return configParseResult;
}
function printDiagnostics(context, diagnostics) {
    each(diagnostics, function (diagnostic) {
        var print;
        var color;
        switch (diagnostic.category) {
            case DiagnosticCategory.Message:
                print = context.info;
                color = white;
                break;
            case DiagnosticCategory.Error:
                print = context.error;
                color = red;
                break;
            case DiagnosticCategory.Warning:
            default:
                print = context.warn;
                color = yellow;
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
    defaults(options, {
        check: true,
        verbosity: VerbosityLevel.Warning,
        clean: false,
        cacheRoot: process.cwd() + "/.rpt2_cache",
        include: ["*.ts+(|x)", "**/*.ts+(|x)"],
        exclude: ["*.d.ts", "**/*.d.ts"],
        abortOnError: true,
        rollupCommonJSResolveHack: false,
    });
    var context = new ConsoleContext(options.verbosity, "rpt2: ");
    context.info("Typescript version: " + version);
    context.debug("Options: " + JSON.stringify(options, undefined, 4));
    var filter$$1 = createFilter(options.include, options.exclude);
    var parsedConfig = parseTsConfig(context);
    var servicesHost = new LanguageServiceHost(parsedConfig);
    var services = createLanguageService(servicesHost, createDocumentRegistry());
    var cache = new Cache(servicesHost, options.cacheRoot, parsedConfig.options, parsedConfig.fileNames, context);
    var cleanTranspile = true;
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
            var result = nodeModuleNameResolver(importee, importer, parsedConfig.options, sys);
            if (result.resolvedModule && result.resolvedModule.resolvedFileName) {
                if (filter$$1(result.resolvedModule.resolvedFileName))
                    cache.setDependency(result.resolvedModule.resolvedFileName, importer);
                if (endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
                    return null;
                var resolved = options.rollupCommonJSResolveHack
                    ? sync(result.resolvedModule.resolvedFileName)
                    : result.resolvedModule.resolvedFileName;
                context.debug(blue("resolving") + " '" + importee + "'");
                context.debug("    to '" + resolved + "'");
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
            // getting compiled file from cache or from ts
            var result = cache.getCompiled(id, snapshot, function () {
                var output = services.getEmitOutput(id);
                if (output.emitSkipped) {
                    cleanTranspile = false;
                    // always checking on fatal errors, even if options.check is set to false
                    var diagnostics = cache.getSyntacticDiagnostics(id, snapshot, function () {
                        return services.getSyntacticDiagnostics(id);
                    }).concat(cache.getSemanticDiagnostics(id, snapshot, function () {
                        return services.getSemanticDiagnostics(id);
                    }));
                    printDiagnostics(contextWrapper, diagnostics);
                    // since no output was generated, aborting compilation
                    _this.error(red("failed to transpile '" + id + "'"));
                }
                var transpiled = find(output.outputFiles, function (entry) { return endsWith(entry.name, ".js"); });
                var map$$1 = find(output.outputFiles, function (entry) { return endsWith(entry.name, ".map"); });
                return {
                    code: transpiled ? transpiled.text : undefined,
                    map: map$$1 ? JSON.parse(map$$1.text) : { mappings: "" },
                };
            });
            if (options.check) {
                var diagnostics = cache.getSyntacticDiagnostics(id, snapshot, function () {
                    return services.getSyntacticDiagnostics(id);
                }).concat(cache.getSemanticDiagnostics(id, snapshot, function () {
                    return services.getSemanticDiagnostics(id);
                }));
                if (diagnostics.length !== 0)
                    cleanTranspile = false;
                printDiagnostics(contextWrapper, diagnostics);
            }
            return result;
        },
        ongenerate: function () {
            cache.done();
            if (!cleanTranspile)
                context.info(yellow("there were errors or warnings above."));
        },
    };
}

export default typescript;
