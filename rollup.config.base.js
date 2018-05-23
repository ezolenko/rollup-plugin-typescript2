import resolve from "rollup-plugin-node-resolve";
import replace from "rollup-plugin-re";

const pkg = require("./package.json");

const makeExternalPredicate = externalArr => {
  if (externalArr.length === 0) {
    return () => false;
  }
  const pattern = new RegExp(`^(${externalArr.join("|")})($|/)`);
  return id => pattern.test(id);
};

export default {
	input: "src/index.ts",

	external: makeExternalPredicate([
		"fs",
		"crypto",
		"path",
		"constants",
		"stream",
		"util",
		"assert",
		"os",
		...Object.keys(pkg.dependencies || {}),
		...Object.keys(pkg.peerDependencies || {}),
	]),

	plugins: [
		replace
		({
			replaces: { "$RPT2_VERSION": pkg.version },
		}),
		resolve({ jsnext: true, preferBuiltins: true }),
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
