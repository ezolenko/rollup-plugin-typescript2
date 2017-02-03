/* eslint-disable */
import { ScriptSnapshot, createDocumentRegistry, createLanguageService, flattenDiagnosticMessageText, getDefaultLibFilePath, parseConfigFileTextToJson, parseJsonConfigFileContent, sys } from 'typescript';
import * as ts from 'typescript';
import { existsSync } from 'fs';
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
function parseTsConfig() {
    var fileName = findFile(process.cwd(), "tsconfig.json");
    var text = sys.readFile(fileName);
    var result = parseConfigFileTextToJson(fileName, text);
    var configParseResult = parseJsonConfigFileContent(result.config, sys, dirname(fileName), undefined, fileName);
    return configParseResult;
}
function typescript(options) {
    options = __assign({}, options);
    var parsedConfig = parseTsConfig();
    console.log("lib:", parsedConfig.options.target, parsedConfig.options.lib);
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
    var printDiagnostics = function (diagnostics) {
        diagnostics.forEach(function (diagnostic) {
            var message = flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            if (diagnostic.file) {
                var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
                console.log("  Error " + diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message);
            }
            else {
                console.log("  Error: " + message);
            }
        });
    };
    return {
        load: function (_id) {
            return ""; // avoiding double loading
        },
        transform: function (_code, id) {
            console.log("transform", id);
            var output = services.getEmitOutput(id);
            if (output.emitSkipped) {
                var allDiagnostics = services
                    .getCompilerOptionsDiagnostics()
                    .concat(services.getSyntacticDiagnostics(id))
                    .concat(services.getSemanticDiagnostics(id));
                printDiagnostics(allDiagnostics);
                throw new Error("failed to transpile " + id);
            }
            var code = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".js"); });
            var map = _.find(output.outputFiles, function (entry) { return _.endsWith(entry.name, ".map"); });
            console.log("code: " + code.name + ", map: " + map.name);
            return {
                code: code ? code.text : undefined,
                map: map ? map.text : undefined,
            };
        },
        outro: function () {
            console.log();
            _.each(parsedConfig.fileNames, function (id) {
                var allDiagnostics = services
                    .getCompilerOptionsDiagnostics()
                    .concat(services.getSyntacticDiagnostics(id))
                    .concat(services.getSemanticDiagnostics(id));
                printDiagnostics(allDiagnostics);
            });
            return;
        },
    };
}

export default typescript;
