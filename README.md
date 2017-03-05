# rollup-plugin-typescript2
[![npm-version](https://img.shields.io/npm/v/rollup-plugin-typescript2.svg?maxAge=2592000)](https://npmjs.org/package/rollup-plugin-typescript2)
![npm-dependencies](https://img.shields.io/david/ezolenko/rollup-plugin-typescript2.svg?maxAge=2592000)

Rollup plugin for typescript with compiler errors. 

This is a rewrite of original rollup-plugin-typescript, starting and borrowing from [this fork](https://github.com/alexlur/rollup-plugin-typescript).

This version is somewhat slower than original, but it will print out typescript syntactic and semantic diagnostic messages (the main reason for using typescript after all).

## Usage

```js
// rollup.config.js
import typescript from 'rollup-plugin-typescript2';

export default {
	entry: './main.ts',

	plugins: [
		typescript()
	]
}
```

The plugin depends on existence of `tsconfig.json` file. All compiler options and file lists are loaded from that. 

Following compiler options are forced though:
* `module`: es2015
* `sourceMap`: true
* `noEmitHelpers`: true
* `importHelpers`: true
* `noResolve`: false

Plugin takes following options:

* `check`: true

	Set to false to avoid doing any diagnostic checks on the code.

* `verbosity`: 2

	Goes up to 3.

* `clean`: false
	
	Set to true for clean build (wipes out cache on every build).

* `cacheRoot`: ".rts2_cache"
	
	Path to cache.

* `include`: `[ "*.ts+(|x)", "**/*.ts+(|x)" ]`

	Passes all .ts files through typescript compiler. 

* `exclude`: `[ "*.d.ts", "**/*.d.ts" ]`

	But excludes types.

* `abortOnError`: true

	Bail out on first syntactic error. Im most cases setting this to false will result in exception in rollup itself.


### TypeScript version
This plugin currently requires TypeScript 2.0+.
