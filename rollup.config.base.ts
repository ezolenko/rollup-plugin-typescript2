import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

import pkg from "./package.json";

export default {
	input: "src/index.ts",

	external: [
		// Node built-ins
		"fs",
		"crypto",
		"path",
		"constants",
		"stream",
		"util",
		"assert",
		"os",
		// deps
		"fs-extra",
		"semver",
		"@rollup/pluginutils",
	],

	plugins: [
		replace
		({
			preventAssignment: true, // remove default warning
			delimiters: ["", ""], // replace all instances
			values:
			{
				"$TS_VERSION_RANGE": pkg.peerDependencies.typescript,
				"$ROLLUP_VERSION_RANGE": pkg.peerDependencies.rollup,
				"$RPT2_VERSION": pkg.version,
			},
		}),
		resolve({ preferBuiltins: true, mainFields: ["module", "jsnext:main", "main"] }),
		commonjs
		({
			include: "node_modules/**",
		}),
	],

	output: [
		{
			format: "cjs",
			file: pkg.main,
			sourcemap: true,
			banner: "/* eslint-disable */",
			exports: "auto",
		},
		{
			format: "es",
			file: pkg.module,
			sourcemap: true,
			banner: "/* eslint-disable */",
			exports: "auto",
		},
		{
			format: "es",
			file: "build-self/index.mjs",
			sourcemap: true,
			banner: "/* eslint-disable */",
			exports: "auto",
		},
	],
};
