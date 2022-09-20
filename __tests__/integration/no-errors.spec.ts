import { jest, afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as fs from "fs-extra";
import { normalizePath as normalize } from "@rollup/pluginutils";

import { RPT2Options } from "../../src/index";
import { filesArr } from "./fixtures/no-errors";
import { findName, genBundle as genBundleH } from "./helpers";

// increase timeout to 20s for whole file since CI occassionally timed out -- these are integration and cache tests, so longer timeout is warranted
jest.setTimeout(20000);

const local = (x: string) => path.resolve(__dirname, x);
const testDir = local("__temp/no-errors");
const fixtureDir = local("fixtures/no-errors");

afterAll(() => fs.remove(testDir));

async function genBundle(relInput: string, extraOpts?: RPT2Options) {
  return genBundleH({
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

  const files = filesArr;
  files.forEach(file => {
    expect(findName(output, file)).toBeTruthy();
  });
  expect(output.length).toEqual(files.length); // no other files

  // JS file should be bundled by Rollup, even though rpt2 does not resolve it (as Rollup natively understands ESM)
  expect(output[0].code).toEqual(expect.stringContaining("identity"));

  // declaration map sources should be correctly remapped (and not point to placeholder dir, c.f. https://github.com/ezolenko/rollup-plugin-typescript2/pull/221)
  const decMap = findName(output, "index.d.ts.map");
  const decMapSources = JSON.parse(decMap.source as string).sources;
  const decRelPath = normalize(path.relative(`${testDir}/dist`, `${fixtureDir}/index.ts`));
  expect(decMapSources).toEqual([decRelPath]);
});

test("integration - no errors - using files list", async () => {
  const { output } = await genBundle("index.ts", { tsconfigOverride: { files: ["index.ts"] } });

  // should still have the type-only import and type-only import import!
  const files = filesArr;
  files.forEach(file => {
    expect(findName(output, file)).toBeTruthy();
  });
  expect(output.length).toEqual(files.length); // no other files
});

test("integration - no errors - no declaration maps", async () => {
  const noDeclarationMaps = { compilerOptions: { declarationMap: false } };
  const { output } = await genBundle("index.ts", {
    tsconfigOverride: noDeclarationMaps,
    clean: true,
  });

  const files = filesArr.filter(file => !file.endsWith(".d.ts.map"));
  files.forEach(file => {
    expect(findName(output, file)).toBeTruthy();
  });
  expect(output.length).toEqual(files.length); // no other files
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

  const files = ["index.js", "some-js-import.d.ts", "some-js-import.d.ts.map"];
  files.forEach(file => {
    expect(findName(output, file)).toBeTruthy();
  });
  expect(output.length).toEqual(files.length); // no other files

  expect(output[0].code).toEqual(expect.stringContaining("identity"));
  expect(output[0].code).not.toEqual(expect.stringContaining("sum")); // no TS files included

  const dec = findName(output, "some-js-import.d.ts");
  expect(dec.source).toEqual(expect.stringContaining("identity"));
});
