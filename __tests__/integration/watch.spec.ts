import { jest, beforeAll, afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as fs from "fs-extra";

import { RPT2Options } from "../../src/index";
import { filesArr } from "./fixtures/no-errors";
import * as helpers from "./helpers";

// increase timeout to 15s for whole file since CI occassionally timed out -- these are integration and cache tests, so longer timeout is warranted
jest.setTimeout(15000);

const local = (x: string) => path.resolve(__dirname, x);
const testDir = local("__temp/watch");
const fixtureDir = `${testDir}/fixtures`;

beforeAll(async () => {
  await fs.ensureDir(fixtureDir);
  // copy the dir to not interfere with other parallel tests since we need to change files for watch mode
  // note we're copying the root fixture dir bc we need the _base_ tsconfig too. maybe optimize in the future or use the other fixtures?
  await fs.copy(local("fixtures"), fixtureDir);
});
afterAll(() => fs.remove(testDir));

async function watchBundle(input: string, extraOpts?: RPT2Options) {
  return helpers.watchBundle({
    input,
    tsconfig: `${path.dirname(input)}/tsconfig.json`, // use the tsconfig of whatever fixture we're in
    testDir,
    extraOpts,
  });
}

test("integration - watch", async () => {
  const srcPath = `${fixtureDir}/no-errors/index.ts`;
  const importPath = `${fixtureDir}/no-errors/some-import.ts`;
  const distDir = `${testDir}/dist`;
  const distPath = `${testDir}/dist/index.js`;
  const decPath = `${distDir}/index.d.ts`;
  const decMapPath = `${decPath}.map`;

  const watcher = await watchBundle(srcPath);

  const files = await fs.readdir(distDir);
  expect(files).toEqual(expect.arrayContaining(filesArr));
  expect(files.length).toBe(filesArr.length); // no other files

  // save content to test against later
  const dist = await fs.readFile(distPath, "utf8");
  const dec = await fs.readFile(decPath, "utf8");
  const decMap = await fs.readFile(decMapPath, "utf8");

  // modify an imported file -- this should cause it and index to change
  await fs.writeFile(importPath, "export const difference = 2", "utf8");
  await helpers.watchEnd(watcher);

  // should have same structure, since names haven't changed and dist hasn't been cleaned
  const files2 = await fs.readdir(distDir);
  expect(files2).toEqual(expect.arrayContaining(filesArr));
  expect(files2.length).toBe(filesArr.length); // no other files

  // should have different content now though
  expect(dist).not.toEqual(await fs.readFile(distPath, "utf8"));
  expect(dec).not.toEqual(await fs.readFile(decPath, "utf8"));
  expect(decMap).not.toEqual(await fs.readFile(decMapPath, "utf8"));

  // modify an imported file to cause a semantic error
  await fs.writeFile(importPath, "export const difference = nonexistent", "utf8")
  await expect(helpers.watchEnd(watcher)).rejects.toThrow("Cannot find name 'nonexistent'.");

  await watcher.close();
});
