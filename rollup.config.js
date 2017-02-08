import ts from '@alexlur/rollup-plugin-typescript';

const pkg = require('./package.json');

export default {
	entry: 'src/index.ts',

	external: [
		'path',
		'fs',
		'object-assign',
		'rollup-pluginutils',
		'typescript',
		'lodash',
		'graphlib',
		'object-hash'
	],

	plugins: [
		ts(),
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
