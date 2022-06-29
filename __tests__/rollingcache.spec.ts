import { beforeEach, afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import { remove, ensureDir, writeFile, pathExists } from "fs-extra";

import { RollingCache } from "../src/rollingcache";


const local = (x: string) => path.resolve(__dirname, x);
const testDir = local("__temp/rollingcache");
const oldCacheDir = `${testDir}/cache`;
const newCacheDir = `${testDir}/cache_`;
const testFile = "file.json";
const oldTestFile = `${oldCacheDir}/${testFile}`;

const nonExistentFile = "this-does-not-exist.json";
const emptyCacheRoot = `${testDir}/empty-cache-root`;

const testFileShape = { a: 1, b: 2, c: 3 };


beforeEach(async () => {
	await ensureDir(oldCacheDir);
	await ensureDir(newCacheDir);
	await writeFile(oldTestFile, JSON.stringify(testFileShape), "utf8");
});
afterAll(() => remove(testDir));


test("RollingCache", async () => {
	const cache = new RollingCache(testDir);

	expect(cache.exists(nonExistentFile)).toBeFalsy();
	expect(cache.exists(testFile)).toBeTruthy();
	expect(cache.path("x")).toEqual(`${oldCacheDir}/x`);
	expect(cache.match([nonExistentFile])).toBeFalsy();
	expect(cache.match([testFile])).toBeTruthy();
	expect(cache.read(testFile)).toEqual(testFileShape);

	cache.write("write-test.json", {a: 2, b: 2, c: 2});
	expect(cache.read("write-test.json")).toEqual({a: 2, b: 2, c: 2});

	cache.write("write-fail.json", (undefined as any));
	expect(cache.read("write-fail.json")).toBeFalsy();

	cache.touch("touched.json");
	expect(await pathExists(`${newCacheDir}/touched.json`)).toBeTruthy();

	cache.roll();
	expect(await pathExists(newCacheDir)).toBeFalsy();
});

test("RollingCache, rolled", async () => {
	const cache = new RollingCache(testDir);
	// roll the cache
	cache.roll();
	// rolling again hits coverage for this.rolled being true already
	cache.roll();
	expect(cache.exists("anything")).toBeFalsy();
	expect(cache.match([])).toBeFalsy();

	cache.write("whatever.json", {whatever: true});
	expect(await pathExists(`${oldCacheDir}/whatever.json`)).toBeFalsy();

	cache.touch("touched.json");
	expect(await pathExists(`${oldCacheDir}/touched.json`)).toBeFalsy();
});

test("RollingCache, test newCache", async () => {
	const cache = new RollingCache(testDir);

	const preExistingFile = `${newCacheDir}/pre-existing.json`;
	await writeFile(preExistingFile, JSON.stringify({}));
	expect(cache.exists("pre-existing.json")).toBeTruthy();
});

test("RollingCache, test match when oldCacheDir is empty", () => {
	const cache = new RollingCache(emptyCacheRoot);

	expect(cache.match([])).toBeTruthy();
	expect(cache.match([testFile])).toBeFalsy();
});
