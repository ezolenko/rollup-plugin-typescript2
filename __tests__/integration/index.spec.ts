import { test, expect } from "@jest/globals";
import * as path from "path";
import { rollup } from "rollup";

import rpt2 from "../../src/index";

const local = (x: string) => path.resolve(__dirname, x);

test("integration - no error case", async () => {
  const bundle = await rollup({
    input: local("fixtures/no-errors/index.ts"),
    plugins: [rpt2({
      tsconfig: local("fixtures/tsconfig.json"),
    })],
  });

  const { output } = await bundle.generate({
    file: './dist/index.ts',
    format: 'esm',
    exports: 'named'
  })

  expect(output[0].fileName).toEqual("index.ts");
  expect(output[1].fileName).toEqual("index.d.ts");
  expect(output[2].fileName).toEqual("index.d.ts.map");
  expect(output[3].fileName).toEqual("some-import.d.ts");
  expect(output[4].fileName).toEqual("some-import.d.ts.map");
  expect(output[5].fileName).toEqual("type-only-import.d.ts");
  expect(output[6].fileName).toEqual("type-only-import.d.ts.map");
  expect(output.length).toEqual(7);
});
