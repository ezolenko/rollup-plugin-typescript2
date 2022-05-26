import { afterAll, test, expect, jest } from "@jest/globals";
import * as path from "path";
import * as ts from "typescript";
import { normalizePath as normalize } from "@rollup/pluginutils";
import { remove } from "fs-extra";

import { makeStubbedContext } from "./fixtures/context";
import { setTypescriptModule } from "../src/tsproxy";
import { IOptions } from "../src/ioptions";
import { getOptionsOverrides, createFilter } from "../src/get-options-overrides";

setTypescriptModule(ts);

const local = (x: string) => normalize(path.resolve(__dirname, x));
const cacheDir = local("__temp/get-options-overrides");

// filter expects an absolute path and resolves include/exclude to process.cwd() by default: https://github.com/ezolenko/rollup-plugin-typescript2/pull/321#discussion_r873077874
const filtPath = (relPath: string) => normalize(`${process.cwd()}/${relPath}`);

afterAll(() => remove(cacheDir));

const defaultConfig: IOptions = {
	include: ["*.ts+(|x)", "**/*.ts+(|x)"],
	exclude: ["*.d.ts", "**/*.d.ts"],
	check: false,
	verbosity: 5,
	clean: false,
	cacheRoot: cacheDir,
	cwd: local(""),
	abortOnError: false,
	rollupCommonJSResolveHack: false,
	typescript: ts,
	objectHashIgnoreUnknownHack: false,
	tsconfigOverride: null,
	useTsconfigDeclarationDir: false,
	tsconfigDefaults: null,
	sourceMapCallback: (id: string, map: string): void => {
		console.log(id + map);
	},
	transformers: [(ls: ts.LanguageService) => {
		console.log(ls);
		return {};
	}],
};

const forcedOptions: ts.CompilerOptions = {
	allowNonTsExtensions: true,
	importHelpers: true,
	inlineSourceMap: false,
	moduleResolution: ts.ModuleResolutionKind.NodeJs,
	noEmit: false,
	noEmitHelpers: false,
	noResolve: false,
	outDir: `${cacheDir}/placeholder`,
};

const defaultPreParsedTsConfig: ts.ParsedCommandLine = {
	options: {},
	fileNames: [],
	errors: [],
};

test("getOptionsOverrides", () => {
	const config = { ...defaultConfig };

	expect(getOptionsOverrides(config)).toStrictEqual(forcedOptions);
});

test("getOptionsOverrides - preParsedTsConfig", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = { ...defaultPreParsedTsConfig };

	expect(getOptionsOverrides(config, preParsedTsConfig)).toStrictEqual({
		...forcedOptions,
		declarationDir: undefined,
		module: ts.ModuleKind.ES2015,
		sourceRoot: undefined,
	});
});

test("getOptionsOverrides - preParsedTsConfig with options.module", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = {
		...defaultPreParsedTsConfig,
		options: {
			module: ts.ModuleKind.AMD,
		},
	};

	expect(getOptionsOverrides(config, preParsedTsConfig)).toStrictEqual({
		...forcedOptions,
		declarationDir: undefined,
		sourceRoot: undefined,
	});
});

test("getOptionsOverrides - with declaration", () => {
	const config = { ...defaultConfig, useTsconfigDeclarationDir: true };
	const preParsedTsConfig = { ...defaultPreParsedTsConfig };

	expect(getOptionsOverrides(config, preParsedTsConfig)).toStrictEqual({
		...forcedOptions,
		module: ts.ModuleKind.ES2015,
		sourceRoot: undefined,
	});
});

test("getOptionsOverrides - with sourceMap", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = {
		...defaultPreParsedTsConfig,
		options: {
			sourceMap: true,
		},
	};

	expect(getOptionsOverrides(config, preParsedTsConfig)).toStrictEqual({
		...forcedOptions,
		declarationDir: undefined,
		module: ts.ModuleKind.ES2015,
	});
});

test("createFilter", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = { ...defaultPreParsedTsConfig };

	const stubbedContext = makeStubbedContext({});
	const filter = createFilter(stubbedContext, config, preParsedTsConfig);

	expect(filter(filtPath("src/test.ts"))).toBe(true);
	expect(filter(filtPath("src/test.js"))).toBe(false);
	expect(filter(filtPath("src/test.d.ts"))).toBe(false);
});

test("createFilter - context.debug", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = { ...defaultPreParsedTsConfig };

	// test context.debug() statements
	const debug = jest.fn(x => x());
	const data = { set debug(x: any) { debug(x) } };
	const stubbedContext = makeStubbedContext(data);

	createFilter(stubbedContext, config, preParsedTsConfig);
	expect(debug.mock.calls.length).toBe(2);
});

test("createFilter - rootDirs", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = {
		...defaultPreParsedTsConfig,
		options: {
			rootDirs: ["src", "lib"]
		},
	};

	const stubbedContext = makeStubbedContext({});
	const filter = createFilter(stubbedContext, config, preParsedTsConfig);

	expect(filter(filtPath("src/test.ts"))).toBe(true);
	expect(filter(filtPath("src/test.js"))).toBe(false);
	expect(filter(filtPath("src/test.d.ts"))).toBe(false);

	expect(filter(filtPath("lib/test.ts"))).toBe(true);
	expect(filter(filtPath("lib/test.js"))).toBe(false);
	expect(filter(filtPath("lib/test.d.ts"))).toBe(false);

	expect(filter(filtPath("not-src/test.ts"))).toBe(false);
});

test("createFilter - projectReferences", () => {
	// test string include and also don't match with "**"
	const config = { ...defaultConfig, include: "*.ts+(|x)" };
	const preParsedTsConfig = {
		...defaultPreParsedTsConfig,
		projectReferences: [
			{ path: "src" },
			{ path: "lib" },
		],
	};

	const stubbedContext = makeStubbedContext({});
	const filter = createFilter(stubbedContext, config, preParsedTsConfig);

	expect(filter(filtPath("src/test.ts"))).toBe(true);
	expect(filter(filtPath("src/test.js"))).toBe(false);
	expect(filter(filtPath("src/test.d.ts"))).toBe(false);

	expect(filter(filtPath("lib/test.ts"))).toBe(true);
	expect(filter(filtPath("lib/test.js"))).toBe(false);
	expect(filter(filtPath("lib/test.d.ts"))).toBe(false);

	expect(filter(filtPath("not-src/test.ts"))).toBe(false);
});
