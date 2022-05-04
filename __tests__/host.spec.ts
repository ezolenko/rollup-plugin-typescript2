import { afterAll, beforeAll, test, expect } from "@jest/globals";
import * as path from "path";
import { readFile, remove, ensureDir, writeFile } from "fs-extra";

import { LanguageServiceHost } from "../src/host";

const local = (x: string) => path.resolve(__dirname, x);
const cwd = local("");
const unaryFunctionExample = "const unary = (x: string): string => x.reverse()";

afterAll(() =>
	Promise.all([
		remove(local("does-exist.ts")),
		remove(local("host-test-dir"))
	])
);
beforeAll(async () => {
	await ensureDir(local("host-test-dir"));
	await writeFile(
		local("host-test-dir/host-test-file.ts"),
		unaryFunctionExample,
		"utf8"
	);
});

test("LanguageServiceHost", async () => {
	const config = {
		fileNames: [],
		errors: [],
		options: { test: "this is a test" }
	};
	const transformers = [() => ({})];
	const host = new LanguageServiceHost(config, transformers, cwd);

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

	const testFile = local("test.ts");
	host.setLanguageService({ pretend: "language-service" } as any);
	expect((host as any).service).toEqual({ pretend: "language-service" });

	const snap = host.setSnapshot(testFile, unaryFunctionExample);
	expect(snap).toEqual({ text: unaryFunctionExample });
	expect((host as any).snapshots[testFile]).toEqual({
		text: unaryFunctionExample
	});
	expect((host as any).versions[testFile]).toEqual(1);

	expect([...(host as any).fileNames]).toEqual([local("test.ts")]);
	expect(host.getScriptSnapshot(testFile)).toEqual({
		text: unaryFunctionExample
	});
	expect(host.getScriptSnapshot(local("does-not-exist.ts"))).toBeFalsy();
	expect(host.getCurrentDirectory()).toEqual(cwd);
	expect(host.getScriptVersion(testFile)).toEqual("1");
	expect(host.getScriptVersion("nothing")).toEqual("0");
	expect(host.getScriptFileNames()).toEqual([local("test.ts")]);
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
	expect(host.directoryExists("no-it-does-not")).toBeFalsy();
	expect(host.getDirectories(".")).toEqual(expect.arrayContaining([
		".git",
		".github",
		"__tests__",
		"dist",
		"node_modules",
		"src"
	]));
	expect(host.getCustomTransformers()).toEqual({ after: [], afterDeclarations: [], before: [] });
	expect(host.fileExists("no-it-does.not")).toBeFalsy();

	await writeFile(local("does-exist.ts"), unaryFunctionExample, "utf8");
	expect(
		host.readDirectory(local("host-test-dir"))
	).toEqual([local("host-test-dir/host-test-file.ts")]);
	expect(host.fileExists(local("does-exist.ts"))).toBeTruthy();
	expect(host.getScriptSnapshot(local("does-exist.ts"))).toEqual({
		text: unaryFunctionExample
	});
});

test("LanguageServiceHost.readFile", () => {
	const config = {
		fileNames: [],
		errors: [],
		options: { test: "this is a test" }
	};
	const transformers = [() => ({})];
	const host = new LanguageServiceHost(config, transformers, cwd);

	expect(
		host.readFile(local("src/host-test-dir/host-test-file.js"))
	).toBeFalsy();
});

// ts.sys.readFile() doesn't ever appear to return anything, so skipping this test for now
test.skip("LanguageServiceHost.readFile", async () => {
	const data = await readFile(local("host-test-dir/host-test-file.ts"), "utf8");
	expect(data).toEqual(unaryFunctionExample);

	const config = {
		fileNames: [],
		errors: [],
		options: { test: "this is a test" }
	};
	const transformers = [() => ({})];
	const host = new LanguageServiceHost(config, transformers, cwd);

	const file = host.readFile(local("host-test-dir/host-test-file.js"));
	expect(file).toEqual(unaryFunctionExample);
});

test("LanguageServiceHost - getCustomTransformers", () => {
	const config = {
		fileNames: [],
		errors: [],
		options: {}
	};
	const transformers = [() => ({ before: () => "test" })];
	const host = new LanguageServiceHost(config, transformers as any, cwd);
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
	const host = new LanguageServiceHost(config, transformers as any, cwd);
	const I = (x: any) => x;
	host.setLanguageService(I as any);
	const customTransformers = host.getCustomTransformers();
	console.warn(customTransformers);

	expect(typeof (customTransformers as any)[0][0]).toEqual("function");
});
