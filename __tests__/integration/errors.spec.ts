import { jest, afterAll, test, expect } from "@jest/globals";
import { Mock } from "jest-mock"
import * as path from "path";
import { normalizePath as normalize } from "@rollup/pluginutils";
import * as fs from "fs-extra";

import { RPT2Options } from "../../src/index";
import { findName, genBundle as genBundleH } from "./helpers";

// increase timeout to 15s for whole file since CI occassionally timed out -- these are integration and cache tests, so longer timeout is warranted
jest.setTimeout(15000);

const local = (x: string) => normalize(path.resolve(__dirname, x));
const testDir = local("__temp/errors");

afterAll(async () => {
  // workaround: there seems to be some race condition causing fs.remove to fail, so give it a sec first (c.f. https://github.com/jprichardson/node-fs-extra/issues/532)
  await new Promise(resolve => setTimeout(resolve, 1000));
  await fs.remove(testDir);
});

async function genBundle(relInput: string, extraOpts?: RPT2Options, onwarn?: Mock) {
  const input = local(`fixtures/errors/${relInput}`);
  return genBundleH({
    input,
    tsconfig: local("fixtures/errors/tsconfig.json"),
    testDir,
    extraOpts: { include: [input], ...extraOpts }, // only include the input itself, not other error files (to only generate types and type-check the one file)
    onwarn,
  });
}

test("integration - semantic error", async () => {
  await expect(genBundle("semantic.ts")).rejects.toThrow("Type 'string' is not assignable to type 'number'.");
});

test("integration - semantic error - abortOnError: false / check: false", async () => {
  const onwarn = jest.fn();
  // either warning or not type-checking should result in the same bundle
  const { output } = await genBundle("semantic.ts", { abortOnError: false }, onwarn);
  const { output: output2 } = await genBundle("semantic.ts", { check: false }, onwarn);
  expect(output).toEqual(output2);

  const files = ["index.js", "semantic.d.ts", "semantic.d.ts.map"];
  files.forEach(file => {
    expect(findName(output, file)).toBeTruthy();
  });
  expect(output.length).toEqual(files.length); // no other files
  expect(onwarn).toBeCalledTimes(1);
});

test("integration - syntax error", async () => {
  await expect(genBundle("syntax.ts")).rejects.toThrow("';' expected.");
});

test("integration - syntax error - abortOnError: false / check: false", async () => {
  const onwarn = jest.fn();
  const err = "Unexpected token (Note that you need plugins to import files that are not JavaScript)";
  await expect(genBundle("syntax.ts", { abortOnError: false }, onwarn)).rejects.toThrow(err);
  await expect(genBundle("syntax.ts", { check: false }, onwarn)).rejects.toThrow(err);
});

const typeOnlyIncludes = ["**/import-type-error.ts", "**/type-only-import-with-error.ts"];

test("integration - type-only import error", async () => {
  await expect(genBundle("import-type-error.ts", {
    include: typeOnlyIncludes,
  })).rejects.toThrow("Property 'nonexistent' does not exist on type 'someObj'.");
});

test("integration - type-only import error - abortOnError: false / check: false", async () => {
  const onwarn = jest.fn();
  // either warning or not type-checking should result in the same bundle
  const { output } = await genBundle("import-type-error.ts", {
    include: typeOnlyIncludes,
    abortOnError: false,
  }, onwarn);
  const { output: output2 } = await genBundle("import-type-error.ts", {
    include: typeOnlyIncludes,
    check: false,
  }, onwarn);
  expect(output).toEqual(output2);

  const files = ["index.js", "import-type-error.d.ts", "import-type-error.d.ts.map", "type-only-import-with-error.d.ts.map", "type-only-import-with-error.d.ts.map"];
  files.forEach(file => {
    expect(findName(output, file)).toBeTruthy();
  });
  expect(output.length).toEqual(files.length); // no other files
  expect(onwarn).toBeCalledTimes(1);
});

// integration test variant of parse-tsconfig unit test, to test how other hooks interact with an error thrown in buildStart
test("integration - tsconfig error", async () => {
  await expect(genBundle("semantic.ts", {
    tsconfigOverride: { compilerOptions: { module: "none" } },
  })).rejects.toThrow("Incompatible tsconfig option. Module resolves to 'None'. This is incompatible with Rollup, please use");
});
