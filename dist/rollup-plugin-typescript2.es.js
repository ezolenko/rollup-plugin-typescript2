/* eslint-disable */
import { concat, defaults, each, endsWith, filter, find, get, has, isEqual, isFunction, map, some } from 'lodash';
import { DiagnosticCategory, ModuleKind, ScriptSnapshot, createDocumentRegistry, createLanguageService, findConfigFile, flattenDiagnosticMessageText, getAutomaticTypeDirectiveNames, getDefaultLibFilePath, nodeModuleNameResolver, parseConfigFileTextToJson, parseJsonConfigFileContent, resolveTypeReferenceDirective, sys, version } from 'typescript';
import { existsSync, readFileSync, readdirSync, renameSync } from 'fs';
import { Graph, alg } from 'graphlib';
import { sha1 } from 'object-hash';
import { emptyDirSync, ensureFileSync, readJsonSync, removeSync, writeJsonSync } from 'fs-extra';
import { blue, green, red, white, yellow } from 'colors/safe';
import { sync } from 'resolve';
import * as resolve from 'resolve';
import { dirname, join, relative } from 'path';

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
        this.hasContext = true;
        this.hasContext = isFunction(this.context.warn) && isFunction(this.context.error);
    }
    RollupContext.prototype.warn = function (message) {
        if (this.verbosity < VerbosityLevel.Warning)
            return;
        if (this.hasContext)
            this.context.warn("" + this.prefix + message);
        else
            console.log("" + this.prefix + message);
    };
    RollupContext.prototype.error = function (message) {
        if (this.verbosity < VerbosityLevel.Error)
            return;
        if (this.hasContext) {
            if (this.bail)
                this.context.error("" + this.prefix + message);
            else
                this.context.warn("" + this.prefix + message);
        }
        else
            console.log("" + this.prefix + message);
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
    LanguageServiceHost.prototype.reset = function () {
        this.snapshots = {};
        this.versions = {};
    };
    LanguageServiceHost.prototype.setSnapshot = function (fileName, data) {
        fileName = this.normalize(fileName);
        var snapshot = ScriptSnapshot.fromString(data);
        this.snapshots[fileName] = snapshot;
        this.versions[fileName] = (this.versions[fileName] || 0) + 1;
        return snapshot;
    };
    LanguageServiceHost.prototype.getScriptSnapshot = function (fileName) {
        fileName = this.normalize(fileName);
        if (has(this.snapshots, fileName))
            return this.snapshots[fileName];
        if (existsSync(fileName)) {
            this.snapshots[fileName] = ScriptSnapshot.fromString(sys.readFile(fileName));
            this.versions[fileName] = (this.versions[fileName] || 0) + 1;
            return this.snapshots[fileName];
        }
        return undefined;
    };
    LanguageServiceHost.prototype.getCurrentDirectory = function () {
        return this.cwd;
    };
    LanguageServiceHost.prototype.getScriptVersion = function (fileName) {
        fileName = this.normalize(fileName);
        return (this.versions[fileName] || 0).toString();
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
    LanguageServiceHost.prototype.useCaseSensitiveFileNames = function () {
        return sys.useCaseSensitiveFileNames;
    };
    LanguageServiceHost.prototype.readDirectory = function (path$$1, extensions, exclude, include) {
        return sys.readDirectory(path$$1, extensions, exclude, include);
    };
    LanguageServiceHost.prototype.readFile = function (path$$1, encoding) {
        return sys.readFile(path$$1, encoding);
    };
    LanguageServiceHost.prototype.fileExists = function (path$$1) {
        return sys.fileExists(path$$1);
    };
    LanguageServiceHost.prototype.getTypeRootsVersion = function () {
        return 0;
    };
    LanguageServiceHost.prototype.directoryExists = function (directoryName) {
        return sys.directoryExists(directoryName);
    };
    LanguageServiceHost.prototype.getDirectories = function (directoryName) {
        return sys.getDirectories(directoryName);
    };
    LanguageServiceHost.prototype.normalize = function (fileName) {
        return fileName.split("\\").join("/");
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
        this.rolled = false;
        this.oldCacheRoot = this.cacheRoot + "/cache";
        this.newCacheRoot = this.cacheRoot + "/cache_";
        emptyDirSync(this.newCacheRoot);
    }
    /**
     * @returns true if name exist in old cache (or either old of new cache if checkNewCache is true)
     */
    RollingCache.prototype.exists = function (name) {
        if (this.rolled)
            return false;
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
        if (this.rolled)
            return false;
        if (!existsSync(this.oldCacheRoot))
            return names.length === 0; // empty folder matches
        return isEqual(readdirSync(this.oldCacheRoot).sort(), names.sort());
    };
    /**
     * @returns data for name, must exist in old cache (or either old of new cache if checkNewCache is true)
     */
    RollingCache.prototype.read = function (name) {
        if (this.checkNewCache && existsSync(this.newCacheRoot + "/" + name))
            return readJsonSync(this.newCacheRoot + "/" + name, { encoding: "utf8" });
        return readJsonSync(this.oldCacheRoot + "/" + name, { encoding: "utf8" });
    };
    RollingCache.prototype.write = function (name, data) {
        if (this.rolled)
            return;
        if (data === undefined)
            return;
        writeJsonSync(this.newCacheRoot + "/" + name, data);
    };
    RollingCache.prototype.touch = function (name) {
        if (this.rolled)
            return;
        ensureFileSync(this.newCacheRoot + "/" + name);
    };
    /**
     * clears old cache and moves new in its place
     */
    RollingCache.prototype.roll = function () {
        if (this.rolled)
            return;
        this.rolled = true;
        removeSync(this.oldCacheRoot);
        renameSync(this.newCacheRoot, this.oldCacheRoot);
    };
    return RollingCache;
}());

function convertDiagnostic(type, data) {
    return map(data, function (diagnostic) {
        var entry = {
            flatMessage: flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
            category: diagnostic.category,
            code: diagnostic.code,
            type: type,
        };
        if (diagnostic.file && diagnostic.start !== undefined) {
            var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
            entry.fileLine = diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + ")";
        }
        return entry;
    });
}
var TsCache = (function () {
    function TsCache(host, cache, options, rollupConfig, rootFilenames, context) {
        var _this = this;
        this.host = host;
        this.options = options;
        this.rollupConfig = rollupConfig;
        this.context = context;
        this.cacheVersion = "6";
        this.ambientTypesDirty = false;
        this.cacheDir = cache + "/" + sha1({
            version: this.cacheVersion,
            rootFilenames: rootFilenames,
            options: this.options,
            rollupConfig: this.rollupConfig,
            tsVersion: version,
        });
        this.dependencyTree = new Graph({ directed: true });
        this.dependencyTree.setDefaultNodeLabel(function (_node) { return ({ dirty: false }); });
        var automaticTypes = map(getAutomaticTypeDirectiveNames(options, sys), function (entry) { return resolveTypeReferenceDirective(entry, undefined, options, sys); })
            .filter(function (entry) { return entry.resolvedTypeReferenceDirective && entry.resolvedTypeReferenceDirective.resolvedFileName; })
            .map(function (entry) { return entry.resolvedTypeReferenceDirective.resolvedFileName; });
        this.ambientTypes = filter(rootFilenames, function (file) { return endsWith(file, ".d.ts"); })
            .concat(automaticTypes)
            .map(function (id) { return ({ id: id, snapshot: _this.host.getScriptSnapshot(id) }); });
        this.init();
        this.checkAmbientTypes();
    }
    TsCache.prototype.clean = function () {
        this.context.info(blue("cleaning cache: " + this.cacheDir));
        emptyDirSync(this.cacheDir);
        this.init();
    };
    TsCache.prototype.setDependency = function (importee, importer) {
        // importee -> importer
        this.context.debug(blue("dependency") + " '" + importee + "'");
        this.context.debug("    imported by '" + importer + "'");
        this.dependencyTree.setEdge(importer, importee);
    };
    TsCache.prototype.walkTree = function (cb) {
        var acyclic = alg.isAcyclic(this.dependencyTree);
        if (acyclic) {
            each(alg.topsort(this.dependencyTree), function (id) { return cb(id); });
            return;
        }
        this.context.info(yellow("import tree has cycles"));
        each(this.dependencyTree.nodes(), function (id) { return cb(id); });
    };
    TsCache.prototype.done = function () {
        this.context.info(blue("rolling caches"));
        this.codeCache.roll();
        this.semanticDiagnosticsCache.roll();
        this.syntacticDiagnosticsCache.roll();
        this.typesCache.roll();
    };
    TsCache.prototype.getCompiled = function (id, snapshot, transform) {
        var name = this.makeName(id, snapshot);
        this.context.info(blue("transpiling") + " '" + id + "'");
        this.context.debug("    cache: '" + this.codeCache.path(name) + "'");
        if (!this.codeCache.exists(name) || this.isDirty(id, false)) {
            this.context.debug(yellow("    cache miss"));
            var transformedData = transform();
            this.codeCache.write(name, transformedData);
            this.markAsDirty(id);
            return transformedData;
        }
        this.context.debug(green("    cache hit"));
        var data = this.codeCache.read(name);
        this.codeCache.write(name, data);
        return data;
    };
    TsCache.prototype.getSyntacticDiagnostics = function (id, snapshot, check) {
        return this.getDiagnostics("syntax", this.syntacticDiagnosticsCache, id, snapshot, check);
    };
    TsCache.prototype.getSemanticDiagnostics = function (id, snapshot, check) {
        return this.getDiagnostics("semantic", this.semanticDiagnosticsCache, id, snapshot, check);
    };
    TsCache.prototype.checkAmbientTypes = function () {
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
    TsCache.prototype.getDiagnostics = function (type, cache, id, snapshot, check) {
        var name = this.makeName(id, snapshot);
        this.context.debug("    cache: '" + cache.path(name) + "'");
        if (!cache.exists(name) || this.isDirty(id, true)) {
            this.context.debug(yellow("    cache miss"));
            var convertedData = convertDiagnostic(type, check());
            cache.write(name, convertedData);
            this.markAsDirty(id);
            return convertedData;
        }
        this.context.debug(green("    cache hit"));
        var data = cache.read(name);
        cache.write(name, data);
        return data;
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
    TsCache.prototype.makeName = function (id, snapshot) {
        var data = snapshot.getText(0, snapshot.getLength());
        return sha1({ data: data, id: id });
    };
    return TsCache;
}());

function printDiagnostics(context, diagnostics) {
    each(diagnostics, function (diagnostic) {
        var print;
        var color;
        var category;
        switch (diagnostic.category) {
            case DiagnosticCategory.Message:
                print = context.info;
                color = white;
                category = "";
                break;
            case DiagnosticCategory.Error:
                print = context.error;
                color = red;
                category = "error";
                break;
            case DiagnosticCategory.Warning:
            default:
                print = context.warn;
                color = yellow;
                category = "warning";
                break;
        }
        var type = diagnostic.type + " ";
        if (diagnostic.fileLine)
            print.call(context, [diagnostic.fileLine + ": " + type + category + " TS" + diagnostic.code + " " + color(diagnostic.flatMessage)]);
        else
            print.call(context, ["" + type + category + " TS" + diagnostic.code + " " + color(diagnostic.flatMessage)]);
    });
}

function getOptionsOverrides(_a) {
    var useTsconfigDeclarationDir = _a.useTsconfigDeclarationDir;
    return __assign({ module: ModuleKind.ES2015, noEmitHelpers: true, importHelpers: true, noResolve: false, outDir: process.cwd() }, (useTsconfigDeclarationDir ? {} : { declarationDir: process.cwd() }));
}

function parseTsConfig(tsconfig, context, pluginOptions) {
    var fileName = findConfigFile(process.cwd(), sys.fileExists, tsconfig);
    if (!fileName)
        throw new Error("couldn't find '" + tsconfig + "' in " + process.cwd());
    var text = sys.readFile(fileName);
    var result = parseConfigFileTextToJson(fileName, text);
    if (result.error) {
        printDiagnostics(context, convertDiagnostic("config", [result.error]));
        throw new Error("failed to parse " + fileName);
    }
    return parseJsonConfigFileContent(result.config, sys, dirname(fileName), getOptionsOverrides(pluginOptions), fileName);
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

// tslint:disable-next-line:no-var-requires
var createFilter = require("rollup-pluginutils").createFilter;
// tslint:enable-next-line:no-var-requires
var watchMode = false;
var round = 0;
var targetCount = 0;
var rollupOptions;
var pluginOptions;
var context;
var filter$1;
var parsedConfig;
var servicesHost;
var service;
var _cache;
var noErrors = true;
var declarations = {};
var cache = function () {
    if (!_cache)
        _cache = new TsCache(servicesHost, pluginOptions.cacheRoot, parsedConfig.options, rollupOptions, parsedConfig.fileNames, context);
    return _cache;
};
function typescript$1(options) {
    pluginOptions = __assign({}, options);
    defaults(pluginOptions, {
        check: true,
        verbosity: VerbosityLevel.Warning,
        clean: false,
        cacheRoot: process.cwd() + "/.rpt2_cache",
        include: ["*.ts+(|x)", "**/*.ts+(|x)"],
        exclude: ["*.d.ts", "**/*.d.ts"],
        abortOnError: true,
        rollupCommonJSResolveHack: false,
        tsconfig: "tsconfig.json",
    });
    return {
        options: function (config) {
            rollupOptions = config;
            context = new ConsoleContext(pluginOptions.verbosity, "rpt2: ");
            context.info("Typescript version: " + version);
            context.debug("Plugin Options: " + JSON.stringify(pluginOptions, undefined, 4));
            filter$1 = createFilter(pluginOptions.include, pluginOptions.exclude);
            parsedConfig = parseTsConfig(pluginOptions.tsconfig, context, pluginOptions);
            servicesHost = new LanguageServiceHost(parsedConfig);
            service = createLanguageService(servicesHost, createDocumentRegistry());
            // printing compiler option errors
            if (pluginOptions.check)
                printDiagnostics(context, convertDiagnostic("options", service.getCompilerOptionsDiagnostics()));
            context.debug("rollupConfig: " + JSON.stringify(rollupOptions, undefined, 4));
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
            var result = nodeModuleNameResolver(importee, importer, parsedConfig.options, sys);
            if (result.resolvedModule && result.resolvedModule.resolvedFileName) {
                if (filter$1(result.resolvedModule.resolvedFileName))
                    cache().setDependency(result.resolvedModule.resolvedFileName, importer);
                if (endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
                    return null;
                var resolved = pluginOptions.rollupCommonJSResolveHack
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
            if (!filter$1(id))
                return undefined;
            var contextWrapper = new RollupContext(pluginOptions.verbosity, pluginOptions.abortOnError, this, "rpt2: ");
            var snapshot = servicesHost.setSnapshot(id, code);
            // getting compiled file from cache or from ts
            var result = cache().getCompiled(id, snapshot, function () {
                var output = service.getEmitOutput(id);
                if (output.emitSkipped) {
                    noErrors = false;
                    // always checking on fatal errors, even if options.check is set to false
                    var diagnostics = concat(cache().getSyntacticDiagnostics(id, snapshot, function () {
                        return service.getSyntacticDiagnostics(id);
                    }), cache().getSemanticDiagnostics(id, snapshot, function () {
                        return service.getSemanticDiagnostics(id);
                    }));
                    printDiagnostics(contextWrapper, diagnostics);
                    // since no output was generated, aborting compilation
                    cache().done();
                    if (isFunction(_this.error))
                        _this.error(red("failed to transpile '" + id + "'"));
                }
                var transpiled = find(output.outputFiles, function (entry) { return endsWith(entry.name, ".js") || endsWith(entry.name, ".jsx"); });
                var map$$1 = find(output.outputFiles, function (entry) { return endsWith(entry.name, ".map"); });
                var dts = find(output.outputFiles, function (entry) { return endsWith(entry.name, ".d.ts"); });
                return {
                    code: transpiled ? transpiled.text : undefined,
                    map: map$$1 ? JSON.parse(map$$1.text) : { mappings: "" },
                    dts: dts,
                };
            });
            if (pluginOptions.check) {
                var diagnostics = concat(cache().getSyntacticDiagnostics(id, snapshot, function () {
                    return service.getSyntacticDiagnostics(id);
                }), cache().getSemanticDiagnostics(id, snapshot, function () {
                    return service.getSemanticDiagnostics(id);
                }));
                if (diagnostics.length > 0)
                    noErrors = false;
                printDiagnostics(contextWrapper, diagnostics);
            }
            if (result && result.dts) {
                declarations[result.dts.name] = result.dts;
                result.dts = undefined;
            }
            return result;
        },
        ongenerate: function (bundleOptions) {
            targetCount = get(bundleOptions, "targets.length", 1);
            if (round >= targetCount) {
                watchMode = true;
                round = 0;
            }
            context.debug("generating target " + (round + 1) + " of " + targetCount);
            if (watchMode && round === 0) {
                context.debug("running in watch mode");
                cache().walkTree(function (id) {
                    var diagnostics = concat(convertDiagnostic("syntax", service.getSyntacticDiagnostics(id)), convertDiagnostic("semantic", service.getSemanticDiagnostics(id)));
                    printDiagnostics(context, diagnostics);
                });
            }
            if (!watchMode && !noErrors)
                context.info(yellow("there were errors or warnings above."));
            cache().done();
            round++;
        },
        onwrite: function (_a) {
            var dest = _a.dest;
            var destDirectory = join(process.cwd(), dirname(dest));
            var baseDeclarationDir = parsedConfig.options.outDir;
            each(declarations, function (_a) {
                var name = _a.name, text = _a.text, writeByteOrderMark = _a.writeByteOrderMark;
                var writeToPath = pluginOptions.useTsconfigDeclarationDir ? name : join(destDirectory, relative(baseDeclarationDir, name));
                sys.writeFile(writeToPath, text, writeByteOrderMark);
            });
        },
    };
}

export default typescript$1;
