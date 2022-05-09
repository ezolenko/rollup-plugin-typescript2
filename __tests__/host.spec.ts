import { afterAll, beforeAll, test, expect } from "@jest/globals";
import * as ts from "typescript";
import * as path from "path";
import { readFile, remove, ensureDir, writeFile } from "fs-extra";

import { setTypescriptModule } from "../src/tsproxy";
import { LanguageServiceHost } from "../src/host";

setTypescriptModule(ts);

const local = (x: string) => path.resolve(__dirname, x);

const unaryFunc = "const unary = (x: string): string => x.reverse()";
const unaryFuncSnap = { text: unaryFunc };

const testDir = local("__temp/host");
const testFileNoExt = `${testDir}/file`;
const testFile = `${testFileNoExt}.ts`;
const testFileJs = `${testFileNoExt}.js`;

const nonExistent = `${testDir}/this-does-not-exist.ts`;

afterAll(() => remove(testDir));
beforeAll(async () => {
	await ensureDir(testDir);
	await writeFile(testFile, unaryFunc, "utf8");
});

test("LanguageServiceHost", async () => {
	const config = {
		fileNames: [],
		errors: [],
		options: { test: "this is a test" }
	};
	const transformers = [() => ({})];
	const host = new LanguageServiceHost(config, transformers, testDir);

	expect(host).toBeTruthy();
	expect(Object.keys(host)).toEqual([
		"parsedConfig",
		"transformers",
		"snapshots",
		"versions",
		"fileNames",
		"cwd",
	]);

	host.reset();
	expect((host as any).snapshots).toEqual({});
	expect((host as any).versions).toEqual({});

	host.setLanguageService({ pretend: "language-service" } as any);
	expect((host as any).service).toEqual({ pretend: "language-service" });

	const snap = host.setSnapshot(testFile, unaryFunc);
	expect(snap).toEqual(unaryFuncSnap);
	expect((host as any).snapshots[testFile]).toEqual(unaryFuncSnap);
	expect((host as any).versions[testFile]).toEqual(1);

	expect([...(host as any).fileNames]).toEqual([testFile]);
	expect(host.getScriptSnapshot(testFile)).toEqual(unaryFuncSnap);
	expect(host.getScriptSnapshot(nonExistent)).toBeFalsy();
	expect(host.getCurrentDirectory()).toEqual(testDir);
	expect(host.getScriptVersion(testFile)).toEqual("1");
	expect(host.getScriptVersion(nonExistent)).toEqual("0");
	expect(host.getScriptFileNames()).toEqual([testFile]);
	expect(host.getCompilationSettings()).toEqual({ test: "this is a test" });
	expect(host.getDefaultLibFileName({})).toEqual(
		local("../node_modules/typescript/lib/lib.d.ts")
	);
	if (process.platform === "win32") {
		expect(host.useCaseSensitiveFileNames()).toBeTruthy();
	} else {
		expect(host.useCaseSensitiveFileNames()).toBeFalsy();
	}
	expect(host.getTypeRootsVersion()).toEqual(0);
	expect(host.directoryExists(nonExistent)).toBeFalsy();
	expect(host.getDirectories(".")).toEqual(expect.arrayContaining([
		".git",
		".github",
		"__tests__",
		"dist",
		"node_modules",
		"src"
	]));
	expect(host.getCustomTransformers()).toEqual({ after: [], afterDeclarations: [], before: [] });
	expect(host.fileExists(nonExistent)).toBeFalsy();
	expect(host.readDirectory(testDir)).toEqual([testFile]);
	expect(host.fileExists(testFile)).toBeTruthy();
});

test("LanguageServiceHost.readFile", () => {
	const config = {
		fileNames: [],
		errors: [],
		options: { test: "this is a test" }
	};
	const transformers = [() => ({})];
	const host = new LanguageServiceHost(config, transformers, testDir);

	expect(host.readFile(testFileJs)).toBeFalsy();
});

// ts.sys.readFile() doesn't ever appear to return anything, so skipping this test for now
test.skip("LanguageServiceHost.readFile", async () => {
	const data = await readFile(testFile, "utf8");
	expect(data).toEqual(unaryFunc);

	const config = {
		fileNames: [],
		errors: [],
		options: { test: "this is a test" }
	};
	const transformers = [() => ({})];
	const host = new LanguageServiceHost(config, transformers, testDir);

	const file = host.readFile(testFileJs);
	expect(file).toEqual(unaryFunc);
});

test("LanguageServiceHost - getCustomTransformers", () => {
	const config = {
		fileNames: [],
		errors: [],
		options: {}
	};
	const transformers = [() => ({ before: () => "test" })];
	const host = new LanguageServiceHost(config, transformers as any, testDir);
	const customTransformers = host.getCustomTransformers();

	expect(customTransformers).toBeFalsy();
});

test.skip("LanguageServiceHost - getCustomTransformers with no service", () => {
	const config = {
		fileNames: [],
		errors: [],
		options: {}
	};
	const transformers = [() => ({ before: () => "test" })];
	const host = new LanguageServiceHost(config, transformers as any, testDir);
	const I = (x: any) => x;
	host.setLanguageService(I as any);
	const customTransformers = host.getCustomTransformers();
	console.warn(customTransformers);

	expect(typeof (customTransformers as any)[0][0]).toEqual("function");
});
