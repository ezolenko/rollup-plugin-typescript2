import { jest, afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as fs from "fs-extra";

import { RPT2Options } from "../../src/index";
import * as helpers from "./helpers";

// increase timeout to 10s for whole file since CI occassionally timed out -- these are integration and cache tests, so longer timeout is warranted
jest.setTimeout(10000);

const local = (x: string) => path.resolve(__dirname, x);
const cacheRoot = local("__temp/no-errors/rpt2-cache"); // don't use the one in node_modules

afterAll(() => fs.remove(cacheRoot));

async function genBundle(extraOpts?: RPT2Options) {
  return helpers.genBundle({
    input: local("fixtures/no-errors/index.ts"),
    tsconfig: local("fixtures/no-errors/tsconfig.json"),
    cacheRoot,
    extraOpts,
  });
}

test("integration - no errors", async () => {
  const { output } = await genBundle({ clean: true });

  // populate the cache
  await genBundle();
  const { output: outputWithCache } = await genBundle();
  expect(output).toEqual(outputWithCache);

  // JS file should be bundled by Rollup, even though rpt2 does not resolve it (as Rollup natively understands ESM)
  expect(output[0].code).toEqual(expect.stringContaining("identity"));

  expect(output[0].fileName).toEqual("index.ts");
  expect(output[1].fileName).toEqual("index.d.ts");
  expect(output[2].fileName).toEqual("index.d.ts.map");
  expect(output[3].fileName).toEqual("some-import.d.ts");
  expect(output[4].fileName).toEqual("some-import.d.ts.map");
  expect(output[5].fileName).toEqual("type-only-import.d.ts");
  expect(output[6].fileName).toEqual("type-only-import.d.ts.map");
  expect(output.length).toEqual(7); // no other files
});

test("integration - no errors - no declaration maps", async () => {
  const noDeclarationMaps = { compilerOptions: { declarationMap: false } };
  const { output } = await genBundle({
    tsconfigOverride: noDeclarationMaps,
    clean: true,
  });

  expect(output[0].fileName).toEqual("index.ts");
  expect(output[1].fileName).toEqual("index.d.ts");
  expect(output[2].fileName).toEqual("some-import.d.ts");
  expect(output[3].fileName).toEqual("type-only-import.d.ts");
  expect(output.length).toEqual(4); // no other files
});


test("integration - no errors - no declarations", async () => {
  const noDeclarations = { compilerOptions: { declaration: false, declarationMap: false } };
  const { output } = await genBundle({
    tsconfigOverride: noDeclarations,
    clean: true,
  });

  expect(output[0].fileName).toEqual("index.ts");
  expect(output.length).toEqual(1); // no other files
});
