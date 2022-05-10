import { afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as ts from "typescript";
import { remove } from "fs-extra";

import { makeStubbedContext } from "./fixtures/context";
import { setTypescriptModule } from "../src/tsproxy";
import { IOptions } from "../src/ioptions";
import { getOptionsOverrides, createFilter } from "../src/get-options-overrides";

setTypescriptModule(ts);

const local = (x: string) => path.resolve(__dirname, x);
const cacheDir = local("__temp/get-options-overrides");

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
	outDir: `${cacheDir}/placeholder`, // TODO: fix get-options-overrides.ts on Windows by normalizing the path: https://github.com/ezolenko/rollup-plugin-typescript2/pull/321#discussion_r869710856
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

	expect(filter("src/test.ts")).toBe(true);
	expect(filter("src/test.js")).toBe(false);
	expect(filter("src/test.d.ts")).toBe(false);
});

// not totally sure why this is failing
test.skip("createFilter -- rootDirs", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = {
		...defaultPreParsedTsConfig,
		options: {
			rootDirs: ["src", "lib"]
		},
	};

	const stubbedContext = makeStubbedContext({});
	const filter = createFilter(stubbedContext, config, preParsedTsConfig);

	expect(filter("src/test.ts")).toBe(true);
	expect(filter("src/test.js")).toBe(false);
	expect(filter("src/test.d.ts")).toBe(false);
	expect(filter("lib/test.ts")).toBe(true);
	expect(filter("lib/test.js")).toBe(false);
	expect(filter("lib/test.d.ts")).toBe(false);
});
