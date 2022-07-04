import { afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as fs from "fs-extra";
import { rollup, OutputAsset } from "rollup";

import rpt2, { RPT2Options } from "../../src/index";

const local = (x: string) => path.resolve(__dirname, x);
const cacheRoot = local("__temp/rpt2-cache"); // don't use the one in node_modules

afterAll(() => fs.remove(cacheRoot));

async function genBundle (input: string, extraOpts?: RPT2Options) {
  const bundle = await rollup({
    input: local(input),
    plugins: [rpt2({
      tsconfig: local("fixtures/tsconfig.json"),
      cacheRoot,
      ...extraOpts,
    })],
  });

  const esm = await bundle.generate({
    file: "./dist/index.ts",
    format: "esm",
    exports: "named",
  });

  // Rollup has some deprecated properties like `get isAsset`, so enumerating them with, e.g. `.toEqual`, causes a bunch of warnings to be output
  // delete the `isAsset` property for (much) cleaner logs
  const { output: files } = esm;
  for (const file of files) {
    if ("isAsset" in file) {
      const optIsAsset = file as Partial<Pick<OutputAsset, "isAsset">> & Omit<OutputAsset, "isAsset">;
      delete optIsAsset["isAsset"];
    }
  }

  return esm;
}

test("integration - no error case", async () => {
  const { output } = await genBundle("fixtures/no-errors/index.ts", { clean: true });
  const { output: outputWithCache } = await genBundle("fixtures/no-errors/index.ts");

  expect(output).toEqual(outputWithCache);

  expect(output[0].fileName).toEqual("index.ts");
  expect(output[1].fileName).toEqual("index.d.ts");
  expect(output[2].fileName).toEqual("index.d.ts.map");
  expect(output[3].fileName).toEqual("some-import.d.ts");
  expect(output[4].fileName).toEqual("some-import.d.ts.map");
  expect(output[5].fileName).toEqual("type-only-import.d.ts");
  expect(output[6].fileName).toEqual("type-only-import.d.ts.map");
  expect(output.length).toEqual(7); // no other files
});
