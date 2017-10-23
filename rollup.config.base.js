import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-re';

const pkg = require('./package.json');

export default {
	input: 'src/index.ts',

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
			replaces: { "$RPT2_VERSION": pkg.version },
		}),
		resolve({ jsnext: true, preferBuiltins: true }),
		commonjs
		({
			include: "node_modules/**",
			namedExports:
			{
				"graphlib": [ "alg", "Graph" ],
				"colors/safe": [ "green", "white", "red", "yellow", "blue" ],
				"lodash": [ "get", "each", "isEqual", "some", "filter", "endsWith", "map", "has", "isFunction", "concat", "find", "defaults", "assign", "merge", "flatMap", "chain" ],
			//	"fs-extra": [ "renameSync", "removeSync", "ensureFileSync", "writeJsonSync", "readJsonSync", "existsSync", "readdirSync", "emptyDirSync" ],
			},
		}),
	],

	banner: '/* eslint-disable */',

	output: [
		{
			format: 'cjs',
			file: pkg.main
		},
		{
			format: 'es',
			file: pkg.module
		},
		{
			format: 'es',
			file: 'build-self/' + pkg.module
		}
	]
};
