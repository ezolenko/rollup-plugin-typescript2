import { afterAll, beforeAll, test, expect, jest } from "@jest/globals";
import * as ts from "typescript";
import * as path from "path";
import { remove, ensureDir, writeFile } from "fs-extra";

import { setTypescriptModule } from "../src/tsproxy";
import { LanguageServiceHost } from "../src/host";

setTypescriptModule(ts);

const defaultConfig = { fileNames: [], errors: [], options: {} };

const unaryFunc = "const unary = (x: string): string => x.reverse()";
const unaryFuncSnap = { text: unaryFunc };

const local = (x: string) => path.resolve(__dirname, x);
const testDir = local("__temp/host");
const testFile = `${testDir}/file.ts`;
const nonExistent = `${testDir}/this-does-not-exist.ts`;

afterAll(() => remove(testDir));
beforeAll(async () => {
	await ensureDir(testDir);
	await writeFile(testFile, unaryFunc, "utf8");
});

test("LanguageServiceHost", async () => {
	const testOpts = { test: "this is a test" };
	const config = { ...defaultConfig, options: testOpts };
	const transformers = [() => ({})];
	const host = new LanguageServiceHost(config, transformers, testDir);

	// test core snapshot functionality
	expect(host.getScriptSnapshot(testFile)).toEqual(unaryFuncSnap);
	expect(host.getScriptVersion(testFile)).toEqual("1");

	expect(host.setSnapshot(testFile, unaryFunc)).toEqual(unaryFuncSnap); // version 2
	expect(host.getScriptSnapshot(testFile)).toEqual(unaryFuncSnap); // get from dict
	expect(host.getScriptVersion(testFile)).toEqual("2");

	expect(host.getScriptSnapshot(nonExistent)).toBeFalsy();
	expect(host.getScriptVersion(nonExistent)).toEqual("0");

	expect(host.getScriptFileNames()).toEqual([testFile]);

	host.reset(); // back to version 1
	expect(host.setSnapshot(testFile, unaryFunc)).toEqual(unaryFuncSnap);
	expect(host.getScriptVersion(testFile)).toEqual("1");

	// test fs functionality, which just uses tsModule.sys equivalents
	expect(host.getCurrentDirectory()).toEqual(testDir);
	expect(host.getDirectories(testDir)).toEqual([]);
	expect(host.directoryExists(nonExistent)).toBeFalsy();
	expect(host.fileExists(nonExistent)).toBeFalsy();
	expect(host.fileExists(testFile)).toBeTruthy();
	expect(host.readDirectory(testDir)).toEqual([testFile]);
	expect(host.readFile(nonExistent)).toBeFalsy();
	expect(host.readFile(testFile)).toEqual(unaryFunc);
	expect(host.useCaseSensitiveFileNames()).toBe(process.platform === "win32");

	// test misc functionality
	expect(host.getCompilationSettings()).toEqual(testOpts);
	expect(host.getDefaultLibFileName({})).toEqual(
		local("../node_modules/typescript/lib/lib.d.ts")
	);
	expect(host.getTypeRootsVersion()).toEqual(0);

	// mock out trace
	console.log = jest.fn();
	host.trace('test log');
	expect(console.log).toHaveBeenCalledWith('test log');
});


test("LanguageServiceHost - getCustomTransformers", () => {
	const config = { ...defaultConfig };
	const transformers = [() => ({
		before: () => "testBefore",
		after: () => "testAfter",
		afterDeclarations: () => "testAfterDeclarations",
	})];
	const host = new LanguageServiceHost(config, transformers as any, testDir);

	host.setLanguageService(true as any);
	const customTransformers = host.getCustomTransformers();
	// tiny helper for all the type coercion etc
	const callTransform = (type: 'before' | 'after' | 'afterDeclarations') => {
		return customTransformers?.[type]?.[0](true as any);
	}

	expect(callTransform('before')).toEqual(transformers[0]().before());
	expect(callTransform('after')).toEqual(transformers[0]().after());
	expect(callTransform('afterDeclarations')).toEqual(transformers[0]().afterDeclarations());
});

test("LanguageServiceHost - getCustomTransformers -- undefined cases", () => {
	const config = { ...defaultConfig };

	// no LS and no transformers cases
	let host = new LanguageServiceHost(config, undefined as any, testDir);
	expect(host.getCustomTransformers()).toBeFalsy(); // no LS
	host.setLanguageService(true as any);
	expect(host.getCustomTransformers()).toBeFalsy(); // no transformers

	// empty transformers case
	host = new LanguageServiceHost(config, [], testDir);
	host.setLanguageService(true as any);
	expect(host.getCustomTransformers()).toBeFalsy(); // empty transformers
});
