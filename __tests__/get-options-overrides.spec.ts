import { afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as ts from "typescript";
import { remove } from "fs-extra";

import { IOptions } from "../src/ioptions";
import { getOptionsOverrides } from "../src/get-options-overrides";

const local = (x: string) => path.resolve(__dirname, x);

afterAll(() => remove(local("fixtures/options")));

const normalizePaths = (props: string[], x: any) => {
	for (const prop of props) {
		if (!x[prop]) continue

		x[prop] = x[prop].substr(x[prop].lastIndexOf("/") + 1);
	}

	return x;
};

const defaultConfig: IOptions = {
	include: [],
	exclude: [],
	check: false,
	verbosity: 5,
	clean: false,
	cacheRoot: local("fixtures/options"),
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
	outDir: "placeholder", // normalized
}

const defaultPreParsedTsConfig: ts.ParsedCommandLine = {
	options: {},
	fileNames: [],
	errors: [],
};

test("getOptionsOverrides", () => {
	const config = { ...defaultConfig };
	expect(normalizePaths(["outDir"], getOptionsOverrides(config))).toStrictEqual(
		{
			...forcedOptions,
		},
	);
});

test("getOptionsOverrides - preParsedTsConfig", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = { ...defaultPreParsedTsConfig };
	expect(normalizePaths(["outDir"], getOptionsOverrides(config, preParsedTsConfig))).toStrictEqual(
		{
			...forcedOptions,
			declarationDir: undefined,
			module: ts.ModuleKind.ES2015,
			sourceRoot: undefined,
		},
	);
});

test("getOptionsOverrides - preParsedTsConfig with options.module", () => {
	const config = { ...defaultConfig };
	const preParsedTsConfig = {
		...defaultPreParsedTsConfig,
		options: {
			module: ts.ModuleKind.AMD,
		},
	};
	expect(normalizePaths(["outDir"], getOptionsOverrides(config, preParsedTsConfig))).toStrictEqual(
		{
			...forcedOptions,
			declarationDir: undefined,
			sourceRoot: undefined,
		},
	);
});

test("getOptionsOverrides - with declaration", () => {
	const config = { ...defaultConfig, useTsconfigDeclarationDir: true };
	const preParsedTsConfig = { ...defaultPreParsedTsConfig };
	expect(normalizePaths(["outDir"], getOptionsOverrides(config, preParsedTsConfig))).toStrictEqual(
		{
			...forcedOptions,
			module: ts.ModuleKind.ES2015,
			sourceRoot: undefined,
		},
	);
});

test("getOptionsOverrides - with sourceMap", () => {
	const config = { ...defaultConfig }
	const preParsedTsConfig = {
		...defaultPreParsedTsConfig,
		options: {
			sourceMap: true,
		},
	};
	expect(normalizePaths(["outDir"], getOptionsOverrides(config, preParsedTsConfig))).toStrictEqual(
		{
			...forcedOptions,
			declarationDir: undefined,
			module: ts.ModuleKind.ES2015,
		},
	);
});
