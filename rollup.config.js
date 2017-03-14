import ts from 'rollup-plugin-typescript2';

const pkg = require('./package.json');

export default {
	entry: 'src/index.ts',

	external: [
		'path',
		'fs-extra',
		'object-assign',
		'rollup-pluginutils',
		'typescript',
		'lodash',
		'graphlib',
		'object-hash',
		'colors/safe',
		'resolve'
	],

	plugins: [
		ts({ verbosity: 3 }),
	],

	banner: '/* eslint-disable */',

	targets: [
		{
			format: 'cjs',
			dest: pkg.main
		},
		{
			format: 'es',
			dest: pkg.module
		}
	]
};
