import { test, expect } from "@jest/globals";
import * as fs from "fs-extra";

import { tslibVersion, tslibSource } from "../src/tslib";

test("tslib", async () => {
  expect(tslibVersion).toEqual(require("tslib/package.json").version);

  const tslibES6 = await fs.readFile(require.resolve("tslib/tslib.es6.js"), "utf8");
  expect(tslibSource).toEqual(tslibES6);
});
