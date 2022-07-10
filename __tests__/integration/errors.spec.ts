import { jest, afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import { normalizePath as normalize } from "@rollup/pluginutils";
import * as fs from "fs-extra";
import { red } from "colors/safe";

import { RPT2Options } from "../../src/index";
import * as helpers from "./helpers";

// increase timeout to 15s for whole file since CI occassionally timed out -- these are integration and cache tests, so longer timeout is warranted
jest.setTimeout(15000);

const local = (x: string) => path.resolve(__dirname, x);
const cacheRoot = local("__temp/errors/rpt2-cache"); // don't use the one in node_modules
const onwarn = jest.fn();

afterAll(async () => {
  // workaround: there seems to be some race condition causing fs.remove to fail, so give it a sec first (c.f. https://github.com/jprichardson/node-fs-extra/issues/532)
  await new Promise(resolve => setTimeout(resolve, 1000));
  await fs.remove(cacheRoot);
});

async function genBundle(relInput: string, extraOpts?: RPT2Options) {
  const input = normalize(local(`fixtures/errors/${relInput}`));
  return helpers.genBundle({
    input,
    tsconfig: local("fixtures/errors/tsconfig.json"),
    cacheRoot,
    extraOpts: { include: [input], ...extraOpts }, // only include the input itself, not other error files (to only generate types and type-check the one file)
    onwarn,
  });
}

test("integration - tsconfig errors", async () => {
  // TODO: move to parse-tsconfig unit tests?
  expect(genBundle("semantic.ts", {
    tsconfig: "non-existent-tsconfig",
  })).rejects.toThrow("rpt2: failed to open 'non-existent-tsconfig'");
});

test("integration - semantic error", async () => {
  expect(genBundle("semantic.ts")).rejects.toThrow(`semantic error TS2322: ${red("Type 'string' is not assignable to type 'number'.")}`);
});

test("integration - semantic error - abortOnError: false / check: false", async () => {
  // either warning or not type-checking should result in the same bundle
  const { output } = await genBundle("semantic.ts", { abortOnError: false });
  const { output: output2 } = await genBundle("semantic.ts", { check: false });
  expect(output).toEqual(output2);

  expect(output[0].fileName).toEqual("index.js");
  expect(output[1].fileName).toEqual("semantic.d.ts");
  expect(output[2].fileName).toEqual("semantic.d.ts.map");
  expect(output.length).toEqual(3); // no other files
  expect(onwarn).toBeCalledTimes(1);
});

test("integration - syntax error", () => {
  expect(genBundle("syntax.ts")).rejects.toThrow(`syntax error TS1005: ${red("';' expected.")}`);
});

test("integration - syntax error - abortOnError: false / check: false", () => {
  const err = "Unexpected token (Note that you need plugins to import files that are not JavaScript)";
  expect(genBundle("syntax.ts", { abortOnError: false })).rejects.toThrow(err);
  expect(genBundle("syntax.ts", { check: false })).rejects.toThrow(err);
});
