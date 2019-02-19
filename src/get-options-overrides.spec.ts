import * as path from "path";
import * as ts from "typescript";
import {getOptionsOverrides} from "./get-options-overrides";
import {remove} from "fs-extra";

const local = (x: string) => path.resolve(__dirname, x);
afterAll(() => remove(local("fixtures/options")));
const normalizePaths = (props: string[], x: any) => {
	props.map((prop: string) => {
		if (x[prop]) {
			x[prop] = x[prop].substr(x[prop].lastIndexOf("/") + 1);
		}
	});
	return x;
};

const makeDefaultConfig = () => ({
	include: [],
	exclude: [],
	check: false,
	verbosity: 5,
	clean: false,
	cacheRoot: local("fixtures/options"),
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
});

test("getOptionsOverrides", () => {
	const config = makeDefaultConfig();
	expect(normalizePaths(["outDir"], getOptionsOverrides(config))).toEqual(
		{
			allowNonTsExtensions: true,
			importHelpers: true,
			inlineSourceMap: false,
			moduleResolution: 2,
			noEmit: false,
			noEmitHelpers: false,
			noResolve: false,
			outDir: "placeholder",
		},
	);
});

test("getOptionsOverrides - preParsedTsConfig", () => {
	const config = makeDefaultConfig();
	const preParsedTsConfig = {
		options: {},
		fileNames: [],
		errors: [],
	};
	expect(normalizePaths(["outDir"], getOptionsOverrides(config, preParsedTsConfig))).toEqual(
		{
			allowNonTsExtensions: true,
			declarationDir: undefined,
			importHelpers: true,
			inlineSourceMap: false,
			moduleResolution: 2,
			module: 5,
			noEmit: false,
			noEmitHelpers: false,
			noResolve: false,
			outDir: "placeholder",
			sourceRoot: undefined,
		},
	);
});

test("getOptionsOverrides - preParsedTsConfig with options.module", () => {
	const config = makeDefaultConfig();
	const preParsedTsConfig = {
		options: {module: 2},
		fileNames: [],
		errors: [],
	};
	expect(normalizePaths(["outDir"], getOptionsOverrides(config, preParsedTsConfig))).toEqual(
		{
			allowNonTsExtensions: true,
			declarationDir: undefined,
			importHelpers: true,
			inlineSourceMap: false,
			moduleResolution: 2,
			noEmit: false,
			noEmitHelpers: false,
			noResolve: false,
			outDir: "placeholder",
			sourceRoot: undefined,
		},
	);
});

test("getOptionsOverrides - with declaration", () => {
	const config = makeDefaultConfig();
	config.useTsconfigDeclarationDir = false;
	const preParsedTsConfig = {
		options: {
			declaration: true,
		},
		fileNames: [],
		errors: [],
	};
	expect(normalizePaths(["outDir", "declarationDir"], getOptionsOverrides(config, preParsedTsConfig))).toEqual(
		{
			allowNonTsExtensions: true,
			declarationDir: "rollup-plugin-typescript2",
			importHelpers: true,
			inlineSourceMap: false,
			moduleResolution: 2,
			module: 5,
			noEmit: false,
			noEmitHelpers: false,
			noResolve: false,
			outDir: "placeholder",
			sourceRoot: undefined,
		},
	);
});

test("getOptionsOverrides - with sourceMap", () => {
	const config = makeDefaultConfig();
	config.useTsconfigDeclarationDir = false;
	const preParsedTsConfig = {
		options: {
			sourceMap: true,
		},
		fileNames: [],
		errors: [],
	};
	expect(normalizePaths(["outDir", "declarationDir"], getOptionsOverrides(config, preParsedTsConfig))).toEqual(
		{
			allowNonTsExtensions: true,
			importHelpers: true,
			inlineSourceMap: false,
			moduleResolution: 2,
			module: 5,
			noEmit: false,
			noEmitHelpers: false,
			noResolve: false,
			outDir: "placeholder",
			sourceRoot: undefined,
		},
	);
});
