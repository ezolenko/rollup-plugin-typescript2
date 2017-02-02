/* eslint-disable */
import { ScriptSnapshot, createDocumentRegistry, createLanguageService, flattenDiagnosticMessageText, getDefaultLibFilePath } from 'typescript';
import * as ts from 'typescript';
import { createFilter } from 'rollup-pluginutils';
import { existsSync, readFileSync } from 'fs';
import * as fs from 'fs';
import { sep } from 'path';
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
function typescript(options) {
    options = __assign({}, options);
    var filter = createFilter(options.include || ["*.ts+(|x)", "**/*.ts+(|x)"], options.exclude || ["*.d.ts", "**/*.d.ts"]);
    // Verify that we're targeting ES2015 modules.
    if (options.module !== "es2015" && options.module !== "es6")
        throw new Error("rollup-plugin-typescript2: The module kind should be 'es2015', found: '" + options.module + "'");
    var cwd = process.cwd();
    var typescript = ts;
    var config = typescript.readConfigFile(findFile(cwd, "tsconfig.json"), function (path$$1) { return readFileSync(path$$1, "utf8"); });
    var compilerOptions = config.config.compilerOptions;
    var files = {};
    var servicesHost = {
        getScriptFileNames: function () { return _.keys(files); },
        getScriptVersion: function (_fileName) { return "0"; },
        getScriptSnapshot: function (fileName) {
            if (!existsSync(fileName))
                return undefined;
            return ScriptSnapshot.fromString(readFileSync(fileName).toString());
        },
        getCurrentDirectory: function () { return process.cwd(); },
        getCompilationSettings: function () { return compilerOptions; },
        getDefaultLibFileName: function (opts) { return getDefaultLibFilePath(opts); },
    };
    var services = createLanguageService(servicesHost, createDocumentRegistry());
    return {
        /*	resolveId(importee: string, importer: string): any
            {
                if (importee === TSLIB)
                    return "\0" + TSLIB;
    
                if (!importer)
                    return null;
    
                let result;
    
                importer = importer.split("\\").join(" / ");
    
                result = typescript.nodeModuleNameResolver( importee, importer, compilerOptions, resolveHost );
    
                if (result.resolvedModule && result.resolvedModule.resolvedFileName)
                {
                    if (_.endsWith(result.resolvedModule.resolvedFileName, ".d.ts"))
                        return null;
    
                    return result.resolvedModule.resolvedFileName;
                }
    
                return null;
            },
    */
        load: function (id) {
            if (!filter(id))
                return;
            return ""; // avoiding double loading
        },
        transform: function (_code, id) {
            if (!filter(id))
                return;
            files[id] = "";
            var output = services.getEmitOutput(id);
            if (output.emitSkipped)
                throw new Error("failed to transpile " + id);
            return {
                code: output.outputFiles[0],
                map: output.outputFiles[1],
            };
        },
        intro: function () {
            return;
        },
        outro: function () {
            _.each(_.keys(files), function (id) {
                var allDiagnostics = services
                    .getCompilerOptionsDiagnostics()
                    .concat(services.getSyntacticDiagnostics(id))
                    .concat(services.getSemanticDiagnostics(id));
                allDiagnostics.forEach(function (diagnostic) {
                    var message = flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                    if (diagnostic.file) {
                        var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
                        console.log("  Error " + diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message);
                    }
                    else {
                        console.log("  Error: " + message);
                    }
                });
            });
            return;
        },
    };
}

export default typescript;
