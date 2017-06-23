import { typescript } from ".";
import * as rollup from "rollup";

// tslint:disable-next-line:no-var-requires
const pkg = require("./package.json");

export const options = {
	entry: "src/index.ts",

	external: [
		"path",
		"fs-extra",
		"object-assign",
		"rollup-pluginutils",
		"typescript",
		"lodash",
		"graphlib",
		"object-hash",
		"colors/safe",
		"resolve",
	],

	plugins: [
		typescript({ verbosity: 3 }),
	],

	banner: "/* eslint-disable */",

	targets: [
		{
			format: "cjs",
			dest: pkg.main,
		},
		{
			format: "es",
			dest: pkg.module,
		},
	],
};

rollup.rollup(options);
