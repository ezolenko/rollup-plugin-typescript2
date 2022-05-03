import { beforeEach, afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as fs from "fs";
import { remove, ensureDir } from "fs-extra";

import { RollingCache } from "../src/rollingcache";


const defaultTestFileShape = {
	a: 1,
	b: 2,
	c: 3,
};
const local = (x: string) => path.resolve(__dirname, x);

beforeEach(() => {
	// pre-create oldCacheRoot
	return ensureDir(local("fixtures/cache")).then(() => {
		// and newCacheRoot
		return ensureDir(local("fixtures/cache_")).then(() => {
			const testfile = local("fixtures/cache/testfile.json");
			fs.writeFileSync(testfile, JSON.stringify(defaultTestFileShape), "utf8");
		});
	});
});

afterAll(
	() => Promise.all([
		remove(local("fixtures")),
		remove(local("not-real")),
	]),
);

test("RollingCache", () => {
	expect(RollingCache).toBeTruthy();

	const cacheRoot = local("fixtures");
	const cache = new RollingCache(cacheRoot, true);
	expect(Object.keys(cache)).toEqual([
		"cacheRoot",
		"checkNewCache",
		"rolled",
		"oldCacheRoot",
		"newCacheRoot",
	]);

	expect(cache.exists("fake-file.json")).toBeFalsy();
	expect(cache.exists("testfile.json")).toBeTruthy();
	expect(cache.path("x")).toEqual(local("fixtures/cache/x"));
	expect(cache.match(["fake-file.json"])).toBeFalsy();
	expect(cache.match(["testfile.json"])).toBeTruthy();
	expect(cache.read("testfile.json")).toEqual(defaultTestFileShape);

	cache.write("write-test.json", {a: 2, b: 2, c: 2});
	expect(
		cache.read("write-test.json"),
	).toEqual({a: 2, b: 2, c: 2});

	cache.write("write-fail.json", (undefined as any));
	expect(
		cache.read("write-fail.json"),
	).toBeFalsy();

	cache.touch("touched.json");
	expect(fs.existsSync(local("fixtures/cache_/touched.json"))).toBeTruthy();
	expect((cache as any).rolled).toBeFalsy();

	cache.roll();
	expect((cache as any).rolled).toBeTruthy();
	expect(fs.existsSync(local("fixtures/cache_"))).toBeFalsy();
});

test("RollingCache, rolled", () => {
	const cacheRoot = local("fixtures");
	const cache = new RollingCache(cacheRoot, true);
	// roll the cache
	cache.roll();
	// rolling again hits coverage for this.rolled being true already
	cache.roll();
	expect(cache.exists("anything")).toBeFalsy();
	expect(cache.match([])).toBeFalsy();

	cache.write("whatever.json", {whatever: true});
	expect(fs.existsSync(local("fixtures/cache/whatever.json"))).toBeFalsy();

	cache.touch("touched.json");
	expect(fs.existsSync(local("fixtures/cache/touched.json"))).toBeFalsy();
});

test("RollingCache, test checkNewCache", (done) => {
	const cacheRoot = local("fixtures");
	const cache = new RollingCache(cacheRoot, true);

	const preExistingTestFile = local("fixtures/cache_/pre-existing.json");
	fs.writeFile(preExistingTestFile, JSON.stringify({}), "utf8", (e?: Error) => {
		if (e) console.log(e);
		expect(cache.exists("pre-existing.json")).toBeTruthy();
		done();
	});
});

test("RollingCache, test match when oldCacheRoot is empty", () => {
	const cacheRoot = local("not-real");
	const cache = new RollingCache(cacheRoot, true);

	expect(cache.match([])).toBeTruthy();
	expect(cache.match(["file.json"])).toBeFalsy();
});
