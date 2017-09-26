import ts from 'rollup-plugin-typescript2';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

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
		resolve({ jsnext: true, preferBuiltins: true }),
		commonjs(
			{
				include: "node_modules/**",
				namedExports:
				{
					"graphlib": [ "alg", "Graph" ],
					"colors/safe": [ "green", "white", "red", "yellow", "blue" ],
					"lodash": [ "get", "each", "isEqual", "some", "filter", "endsWith", "map", "has", "isFunction", "concat", "find", "defaults" ],
				//	"fs-extra": [ "renameSync", "removeSync", "ensureFileSync", "writeJsonSync", "readJsonSync", "existsSync", "readdirSync", "emptyDirSync" ],
				},
			}
		),
		ts({ verbosity: 3, abortOnError: false }),
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
		}
	]
};
