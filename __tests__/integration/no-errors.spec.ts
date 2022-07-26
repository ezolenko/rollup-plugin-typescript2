import { jest, afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as fs from "fs-extra";
import { OutputAsset } from "rollup";
import { normalizePath as normalize } from "@rollup/pluginutils";

import { RPT2Options } from "../../src/index";
import * as helpers from "./helpers";

// increase timeout to 15s for whole file since CI occassionally timed out -- these are integration and cache tests, so longer timeout is warranted
jest.setTimeout(15000);

const local = (x: string) => path.resolve(__dirname, x);
const testDir = local("__temp/no-errors");
const fixtureDir = local("fixtures/no-errors");

afterAll(() => fs.remove(testDir));

async function genBundle(relInput: string, extraOpts?: RPT2Options) {
  return helpers.genBundle({
    input: `${fixtureDir}/${relInput}`,
    tsconfig: `${fixtureDir}/tsconfig.json`,
    testDir,
    extraOpts,
  });
}

test("integration - no errors", async () => {
  const { output } = await genBundle("index.ts", { clean: true });

  // populate the cache
  await genBundle("index.ts");
  const { output: outputWithCache } = await genBundle("index.ts");
  expect(output).toEqual(outputWithCache);

  expect(output[0].fileName).toEqual("index.js");
  expect(output[1].fileName).toEqual("index.d.ts");
  expect(output[2].fileName).toEqual("index.d.ts.map");
  expect(output[3].fileName).toEqual("some-import.d.ts");
  expect(output[4].fileName).toEqual("some-import.d.ts.map");
  expect(output[5].fileName).toEqual("type-only-import.d.ts");
  expect(output[6].fileName).toEqual("type-only-import.d.ts.map");
  expect(output.length).toEqual(7); // no other files

  // JS file should be bundled by Rollup, even though rpt2 does not resolve it (as Rollup natively understands ESM)
  expect(output[0].code).toEqual(expect.stringContaining("identity"));

  // declaration map sources should be correctly remapped (and not point to placeholder dir, c.f. https://github.com/ezolenko/rollup-plugin-typescript2/pull/221)
  const decMapSources = JSON.parse((output[2] as OutputAsset).source as string).sources;
  const decRelPath = normalize(path.relative(`${testDir}/dist`, `${fixtureDir}/index.ts`));
  expect(decMapSources).toEqual([decRelPath]);
});

test("integration - no errors - no declaration maps", async () => {
  const noDeclarationMaps = { compilerOptions: { declarationMap: false } };
  const { output } = await genBundle("index.ts", {
    tsconfigOverride: noDeclarationMaps,
    clean: true,
  });

  expect(output[0].fileName).toEqual("index.js");
  expect(output[1].fileName).toEqual("index.d.ts");
  expect(output[2].fileName).toEqual("some-import.d.ts");
  expect(output[3].fileName).toEqual("type-only-import.d.ts");
  expect(output.length).toEqual(4); // no other files
});


test("integration - no errors - no declarations", async () => {
  const noDeclarations = { compilerOptions: { declaration: false, declarationMap: false } };
  const { output } = await genBundle("index.ts", {
    tsconfigOverride: noDeclarations,
    clean: true,
  });

  expect(output[0].fileName).toEqual("index.js");
  expect(output.length).toEqual(1); // no other files
});

test("integration - no errors - allowJs + emitDeclarationOnly", async () => {
  const { output } = await genBundle("some-js-import.js", {
    include: ["**/*.js"],
    tsconfigOverride: {
      compilerOptions: {
        allowJs: true,
        emitDeclarationOnly: true,
      },
    },
  });

  expect(output[0].fileName).toEqual("index.js");
  expect(output[1].fileName).toEqual("some-js-import.d.ts");
  expect(output[2].fileName).toEqual("some-js-import.d.ts.map");
  expect(output.length).toEqual(3); // no other files

  expect(output[0].code).toEqual(expect.stringContaining("identity"));
  expect(output[0].code).not.toEqual(expect.stringContaining("sum")); // no TS files included
  expect("source" in output[1] && output[1].source).toEqual(expect.stringContaining("identity"));
});
