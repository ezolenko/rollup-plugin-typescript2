import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import replace from "rollup-plugin-re";

const pkg = require("./package.json");

export default {
	input: "src/index.ts",

	external: [
		"fs",
		"fs-extra",
		"resolve",
		"crypto",
		"path",
		"constants",
		"stream",
		"util",
		"assert",
		"os",
	],

	plugins: [
		replace
		({
			replaces: 
			{ 
				"$RPT2_VERSION": pkg.version, 
				"$TS_VERSION_RANGE": pkg.peerDependencies.typescript
			},
		}),
		resolve({ jsnext: true, preferBuiltins: true }),
		commonjs
		({
			include: "node_modules/**",
			namedExports:
			{
				"colors/safe": [ "green", "white", "red", "yellow", "blue" ],
				"lodash": [ "get", "each", "isEqual", "some", "filter", "endsWith", "map", "has", "isFunction", "concat", "find", "defaults", "assign", "merge", "flatMap", "chain" ],
			//	"fs-extra": [ "renameSync", "removeSync", "ensureFileSync", "writeJsonSync", "readJsonSync", "existsSync", "readdirSync", "emptyDirSync" ],
			},
		}),
	],

	output: [
		{
			format: "cjs",
			file: pkg.main,
			sourcemap: true,
			banner: "/* eslint-disable */",
		},
		{
			format: "es",
			file: pkg.module,
			sourcemap: true,
			banner: "/* eslint-disable */",
		},
		{
			format: "es",
			file: "build-self/" + pkg.module,
			sourcemap: true,
			banner: "/* eslint-disable */",
		},
	],
};
