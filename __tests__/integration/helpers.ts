import { rollup, watch, RollupOptions, OutputOptions, RollupOutput, OutputAsset, RollupWatcher } from "rollup";
import * as path from "path";

import rpt2, { RPT2Options } from "../../src/index";

type Params = {
  input: string,
  tsconfig: string,
  testDir: string,
  extraOpts?: RPT2Options,
  onwarn?: RollupOptions['onwarn'],
};

function createInput ({ input, tsconfig, testDir, extraOpts, onwarn }: Params) {
  return {
    input,
    plugins: [rpt2({
      tsconfig,
      cacheRoot: `${testDir}/rpt2-cache`, // don't use the one in node_modules
      ...extraOpts,
    })],
    onwarn,
  }
}

function createOutput (testDir: string): OutputOptions {
  return {
    file: path.resolve(`${testDir}/dist/index.js`), // put outputs in temp test dir
    format: "esm",
    exports: "named",
  }
}

export async function genBundle (inputArgs: Params) {
  const bundle = await rollup(createInput(inputArgs));
  const esm = await bundle.generate(createOutput(inputArgs.testDir));

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

/** wrap Listener interface in a Promise */
export function watchEnd (watcher: RollupWatcher) {
  return new Promise<void>((resolve, reject) => {
    watcher.on("event", event => {
      if ("result" in event)
        event.result?.close(); // close all bundles

      if (event.code === "END")
        resolve();
      else if (event.code === "ERROR")
        reject(event.error);
    });
  });
}

export async function watchBundle (inputArgs: Params) {
  const watcher = watch({
    ...createInput(inputArgs),
    output: createOutput(inputArgs.testDir),
  });

  await watchEnd(watcher); // wait for build to end before returning, similar to genBundle
  return watcher;
}

export function findName (output: RollupOutput['output'], name: string) {
  // type-cast to simplify type-checking -- [0] is always chunk, rest are always asset in our case
  return output.find(file => file.fileName === name) as OutputAsset;
}
