import { jest, afterAll, test, expect } from "@jest/globals";
import * as path from "path";
import * as fs from "fs-extra";
import { red } from "colors/safe";

import { RPT2Options } from "../../src/index";
import * as helpers from "./helpers";

const local = (x: string) => path.resolve(__dirname, x);
const cacheRoot = local("__temp/errors/rpt2-cache"); // don't use the one in node_modules
const onwarn = jest.fn();

afterAll(() => fs.remove(cacheRoot));

async function genBundle(extraOpts?: RPT2Options) {
  return helpers.genBundle({
    input: local("fixtures/errors/index.ts"),
    tsconfig: local("fixtures/errors/tsconfig.json"),
    cacheRoot,
    extraOpts,
    onwarn,
  });
}

test("integration - errors", async () => {
  // TODO: move to parse-tsconfig unit tests?
  expect(genBundle({
    tsconfig: 'non-existent-tsconfig',
  })).rejects.toThrow("rpt2: failed to open 'undefined'"); // FIXME: bug: this should be "non-existent-tsconfig", not "undefined"

  expect(genBundle()).rejects.toThrow(`semantic error TS2322: ${red("Type 'string' is not assignable to type 'number'.")}`);

  // either warning or not type-checking should result in the same bundle
  const { output } = await genBundle({ abortOnError: false });
  const { output: output2 } = await genBundle({ check: false });
  expect(output).toEqual(output2);

  expect(output[0].fileName).toEqual("index.ts");
  expect(output[1].fileName).toEqual("index.d.ts");
  expect(output[2].fileName).toEqual("index.d.ts.map");
  expect(output.length).toEqual(3);
  expect(onwarn).toBeCalledTimes(1);
});


