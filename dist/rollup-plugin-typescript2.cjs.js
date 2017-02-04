/* eslint-disable */
'use strict';

var ts = require('typescript');
var rollupPluginutils = require('rollup-pluginutils');
var fs = require('fs');
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

var _ = require("lodash");
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
function parseTsConfig() {
    var fileName = findFile(process.cwd(), "tsconfig.json");
    var text = ts.sys.readFile(fileName);
    var result = ts.parseConfigFileTextToJson(fileName, text);
    var configParseResult = ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(fileName), undefined, fileName);
    return configParseResult;
}
function printDiagnostics(context, diagnostics) {
    diagnostics.forEach(function (diagnostic) {
        var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        if (diagnostic.file) {
            var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
            context.warn({ message: diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message });
        }
        else
            context.warn({ message: message });
    });
}

function typescript(options) {
    options = __assign({}, options);
    var filter = rollupPluginutils.createFilter(options.include || ["*.ts+(|x)", "**/*.ts+(|x)"], options.exclude || ["*.d.ts", "**/*.d.ts"]);
    delete options.include;
    delete options.exclude;
    var parsedConfig = parseTsConfig();
    if (parsedConfig.options.module !== ts.ModuleKind.ES2015)
        throw new Error("rollup-plugin-typescript2: The module kind should be 'es2015', found: '" + ts.ModuleKind[parsedConfig.options.module] + "'");
    var servicesHost = {
        getScriptFileNames: function () { return parsedConfig.fileNames; },
        getScriptVersion: function (_fileName) { return "0"; },
        getScriptSnapshot: function (fileName) {
            if (!fs.existsSync(fileName))
                return undefined;
            return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName));
        },
        getCurrentDirectory: function () { return process.cwd(); },
        getCompilationSettings: function () { return parsedConfig.options; },
        getDefaultLibFileName: function (opts) { return ts.getDefaultLibFilePath(opts); },
    };
    var services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
    return {
        resolveId: function (importee, importer) {
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
            if (!filter(id))
                return null;
            return ""; // avoiding double loading
        },
        transform: function (_code, id) {
            if (!filter(id))
                return null;
            var output = services.getEmitOutput(id);
            var allDiagnostics = services
                .getCompilerOptionsDiagnostics()
                .concat(services.getSyntacticDiagnostics(id))
                .concat(services.getSemanticDiagnostics(id));
            printDiagnostics(this, allDiagnostics);
            if (output.emitSkipped)
                this.error({ message: "failed to transpile " + id });
            var code = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".js"); });
            var map = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".map"); });
            return {
                code: code ? code.text : undefined,
                map: map ? JSON.parse(map.text) : { mappings: "" },
            };
        },
    };
}

module.exports = typescript;
