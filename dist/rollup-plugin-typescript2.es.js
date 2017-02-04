/* eslint-disable */
import { ModuleKind, ScriptSnapshot, createDocumentRegistry, createLanguageService, flattenDiagnosticMessageText, getDefaultLibFilePath, nodeModuleNameResolver, parseConfigFileTextToJson, parseJsonConfigFileContent, sys } from 'typescript';
import * as ts from 'typescript';
import { createFilter } from 'rollup-pluginutils';
import { existsSync, readFileSync } from 'fs';
import * as fs from 'fs';
import { dirname, sep } from 'path';
import * as path from 'path';

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
function getDefaultOptions() {
    return {
        noEmitHelpers: true,
        module: ModuleKind.ES2015,
        sourceMap: true,
        importHelpers: true,
    };
}
// Gratefully lifted from 'look-up', due to problems using it directly:
//   https://github.com/jonschlinkert/look-up/blob/master/index.js
//   MIT Licenced
function findFile(cwd, filename) {
    var fp = cwd ? (cwd + "/" + filename) : filename;
    if (existsSync(fp)) {
        return fp;
    }
    var segs = cwd.split(sep);
    var len = segs.length;
    while (len--) {
        cwd = segs.slice(0, len).join("/");
        fp = cwd + "/" + filename;
        if (existsSync(fp)) {
            return fp;
        }
    }
    return null;
}
// The injected id for helpers.
var TSLIB = "tslib";
var tslibSource;
try {
    var tslibPath = require.resolve("tslib/" + require("tslib/package.json")["module"]);
    tslibSource = readFileSync(tslibPath, "utf8");
}
catch (e) {
    console.warn("Error loading `tslib` helper library.");
    throw e;
}
function parseTsConfig() {
    var fileName = findFile(process.cwd(), "tsconfig.json");
    var text = sys.readFile(fileName);
    var result = parseConfigFileTextToJson(fileName, text);
    var configParseResult = parseJsonConfigFileContent(result.config, sys, dirname(fileName), getDefaultOptions(), fileName);
    return configParseResult;
}
function printDiagnostics(context, diagnostics) {
    diagnostics.forEach(function (diagnostic) {
        var message = flattenDiagnosticMessageText(diagnostic.messageText, "\n");
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
    var filter = createFilter(options.include || ["*.ts+(|x)", "**/*.ts+(|x)"], options.exclude || ["*.d.ts", "**/*.d.ts"]);
    delete options.include;
    delete options.exclude;
    var parsedConfig = parseTsConfig();
    if (parsedConfig.options.module !== ModuleKind.ES2015)
        throw new Error("rollup-plugin-typescript2: The module kind should be 'es2015', found: '" + ModuleKind[parsedConfig.options.module] + "'");
    var servicesHost = {
        getScriptFileNames: function () { return parsedConfig.fileNames; },
        getScriptVersion: function (_fileName) { return "0"; },
        getScriptSnapshot: function (fileName) {
            if (!existsSync(fileName))
                return undefined;
            return ScriptSnapshot.fromString(sys.readFile(fileName));
        },
        getCurrentDirectory: function () { return process.cwd(); },
        getCompilationSettings: function () { return parsedConfig.options; },
        getDefaultLibFileName: function (opts) { return getDefaultLibFilePath(opts); },
    };
    var services = createLanguageService(servicesHost, createDocumentRegistry());
    return {
        resolveId: function (importee, importer) {
            if (importee === TSLIB)
                return "\0" + TSLIB;
            if (!importer)
                return null;
            importer = importer.split("\\").join("/");
            var result = nodeModuleNameResolver(importee, importer, parsedConfig.options, sys);
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

export default typescript;
