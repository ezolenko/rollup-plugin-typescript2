import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from "rollup-plugin-re";

const pkg = require("./package.json");

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
			replaces:
			{
				"$TS_VERSION_RANGE": pkg.peerDependencies.typescript,
				"$ROLLUP_VERSION_RANGE": pkg.peerDependencies.rollup,
				"$RPT2_VERSION": pkg.version,
			},
		}),
		resolve({ jsnext: true, preferBuiltins: true, }),
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
			file: "build-self/" + pkg.module,
			sourcemap: true,
			banner: "/* eslint-disable */",
			exports: "auto",
		},
	],
};
