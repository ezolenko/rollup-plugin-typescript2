import replace from "rollup-plugin-re";

const pkg = require("./package.json");

export default {
	input: "src/index.ts",

	external: [
		...Object.keys(pkg.dependencies),
		...Object.keys(pkg.devDependencies),
		"colors/safe",
		"fs",
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
			replaces: {"$RPT2_VERSION": pkg.version},
		})
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
