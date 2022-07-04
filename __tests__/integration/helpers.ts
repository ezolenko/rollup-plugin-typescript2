import { rollup, RollupOptions, OutputAsset } from "rollup";

import rpt2, { RPT2Options } from "../../src/index";

type Params = {
  input: string,
  tsconfig: string,
  cacheRoot: string,
  extraOpts?: RPT2Options,
  onwarn?: RollupOptions['onwarn'],
};

export async function genBundle ({ input, tsconfig, cacheRoot, extraOpts, onwarn }: Params) {
  const bundle = await rollup({
    input,
    plugins: [rpt2({
      tsconfig,
      cacheRoot,
      ...extraOpts,
    })],
    onwarn,
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
