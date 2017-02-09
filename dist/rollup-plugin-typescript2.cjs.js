/* eslint-disable */
'use strict';

var fs = require('fs');
var ts = require('typescript');
var _ = require('lodash');
var graph = require('graphlib');
var hash = require('object-hash');
var rollupPluginutils = require('rollup-pluginutils');
var path = require('path');

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

var Cache = (function () {
    function Cache(cacheRoot, options, rootFilenames) {
        this.cacheRoot = cacheRoot;
        this.options = options;
        this.treeComplete = false;
        this.cacheRoot = this.cacheRoot + "/" + hash.sha1({ rootFilenames: rootFilenames, options: this.options });
        fs.mkdirSync(this.cacheRoot);
        var dependencyTreeFile = this.cacheRoot + "/tree";
        if (fs.existsSync(dependencyTreeFile)) {
            var data = fs.readFileSync(this.cacheRoot + "/tree", "utf8");
            this.dependencyTree = graph.json.read(JSON.parse(data));
        }
        else
            this.dependencyTree = new graph.Graph({ directed: true });
        this.dependencyTree.setDefaultNodeLabel(function (_node) { return { dirty: false }; });
    }
    Cache.prototype.walkTree = function (cb) {
        _.each(graph.alg.topsort(this.dependencyTree), function (id) { return cb(id); });
    };
    Cache.prototype.setDependency = function (importee, importer) {
        // importer -> importee
        this.dependencyTree.setEdge(importer, importee);
    };
    Cache.prototype.lastDependencySet = function () {
        this.treeComplete = true;
    };
    Cache.prototype.markAsDirty = function (id, _snapshot) {
        this.dependencyTree.setNode(id, { dirty: true });
    };
    // returns true if node or any of its imports changed
    Cache.prototype.isDirty = function (id, _snapshot, checkImports) {
        var _this = this;
        var label = this.dependencyTree.node(id);
        if (checkImports || label.dirty)
            return label.dirty;
        var dependencies = graph.alg.dijkstra(this.dependencyTree, id);
        return _.some(_.keys(dependencies), function (dependencyId) { return _this.dependencyTree.node(dependencyId).dirty; });
    };
    Cache.prototype.getCompiled = function (id, snapshot, transform) {
        var path$$1 = this.makePath(id, snapshot);
        if (!fs.existsSync(path$$1) || this.isDirty(id, snapshot, false)) {
            var data = transform();
            this.setCache(path$$1, id, snapshot, data);
            return data;
        }
        return JSON.parse(fs.readFileSync(path$$1, "utf8"));
    };
    Cache.prototype.getDiagnostics = function (id, snapshot, check) {
        var path$$1 = this.makePath(id, snapshot) + ".diagnostics";
        if (!fs.existsSync(path$$1) || this.isDirty(id, snapshot, true)) {
            var data = check();
            this.setCache(path$$1, id, snapshot, data);
            return data;
        }
        return JSON.parse(fs.readFileSync(path$$1, "utf8"));
    };
    Cache.prototype.setCache = function (path$$1, id, snapshot, data) {
        if (data === undefined)
            return;
        fs.writeFileSync(path$$1, JSON.stringify(data));
        this.markAsDirty(id, snapshot);
    };
    Cache.prototype.makePath = function (id, snapshot) {
        var data = snapshot.getText(0, snapshot.getLength());
        return this.cacheRoot + "/" + hash.sha1({ data: data, id: id });
    };
    return Cache;
}());

function getOptionsOverrides() {
    return {
        module: ts.ModuleKind.ES2015,
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
    if (fs.existsSync(fp)) {
        return fp;
    }
    var segs = cwd.split(path.sep);
    var len = segs.length;
    while (len--) {
        cwd = segs.slice(0, len).join("/");
        fp = cwd + "/" + filename;
        if (fs.existsSync(fp)) {
            return fp;
        }
    }
    return null;
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
function parseTsConfig() {
    var fileName = findFile(process.cwd(), "tsconfig.json");
    var text = ts.sys.readFile(fileName);
    var result = ts.parseConfigFileTextToJson(fileName, text);
    var configParseResult = ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(fileName), getOptionsOverrides(), fileName);
    return configParseResult;
}
function printDiagnostics(diagnostics) {
    diagnostics.forEach(function (diagnostic) {
        var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        if (diagnostic.file) {
            var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
            console.log(diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message);
        }
        else
            console.log(message);
    });
}

function typescript(options) {
    options = __assign({}, options);
    var filter = rollupPluginutils.createFilter(options.include || ["*.ts+(|x)", "**/*.ts+(|x)"], options.exclude || ["*.d.ts", "**/*.d.ts"]);
    delete options.include;
    delete options.exclude;
    var parsedConfig = parseTsConfig();
    var servicesHost = new LanguageServiceHost(parsedConfig);
    var services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
    var cache = new Cache(process.cwd(), parsedConfig.options, parsedConfig.fileNames);
    return {
        resolveId: function (importee, importer) {
            cache.setDependency(importee, importer);
            if (importee === TSLIB)
                return "\0" + TSLIB;
            if (!importer)
                return null;
            importer = importer.split("\\").join("/");
            var result = ts.nodeModuleNameResolver(importee, importer, parsedConfig.options, ts.sys);
            if (result.resolvedModule && result.resolvedModule.resolvedFileName) {
                if (_.endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
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
            if (!filter(id))
                return null;
            var snapshot = servicesHost.setSnapshot(id, code);
            var result = cache.getCompiled(id, snapshot, function () {
                var output = services.getEmitOutput(id);
                if (output.emitSkipped)
                    _this.error({ message: "failed to transpile " + id });
                var transpiled = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".js"); });
                var map = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".map"); });
                return {
                    code: transpiled ? transpiled.text : undefined,
                    map: map ? JSON.parse(map.text) : { mappings: "" },
                };
            });
            return result;
        },
        outro: function () {
            cache.lastDependencySet();
            cache.walkTree(function (id) {
                var snapshot = servicesHost.getScriptSnapshot(id);
                var diagnostics = cache.getDiagnostics(id, snapshot, function () {
                    return services
                        .getCompilerOptionsDiagnostics()
                        .concat(services.getSyntacticDiagnostics(id))
                        .concat(services.getSemanticDiagnostics(id));
                });
                if (diagnostics.length !== 0) {
                    console.log(id);
                    printDiagnostics(diagnostics);
                }
            });
        },
    };
}

module.exports = typescript;
