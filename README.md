# rollup-plugin-typescript2

[![npm-version](https://img.shields.io/npm/v/rollup-plugin-typescript2.svg?maxAge=2592000)](https://npmjs.org/package/rollup-plugin-typescript2)
![npm-dependencies](https://img.shields.io/david/ezolenko/rollup-plugin-typescript2.svg?maxAge=2592000)
[![Codeship Status](https://app.codeship.com/projects/fe9cf8f0-e8d4-0134-ec88-4e3d33dcd7ed/status?branch=master)](https://app.codeship.com/projects/207445)

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
* `noEmitHelpers`: true
* `importHelpers`: true
* `noResolve`: false

Plugin takes following options:

* `check`: true

	Set to false to avoid doing any diagnostic checks on the code.

* `verbosity`: 1

	- 0 -- Error
	- 1 -- Warning
	- 2 -- Info
	- 3 -- Debug

* `clean`: false
	
	Set to true for clean build (wipes out cache on every build).

* `cacheRoot`: ".rts2_cache"
	
	Path to cache.

* `include`: `[ "*.ts+(|x)", "**/*.ts+(|x)" ]`

	By default passes all .ts files through typescript compiler. 

* `exclude`: `[ "*.d.ts", "**/*.d.ts" ]`

	But excludes type definitions.

* `abortOnError`: true

	Bail out on first syntactic or semantic error. In some cases setting this to false will result in exception in rollup itself (for example for unresolvable imports).

* `rollupCommonJSResolveHack`: false

	On windows typescript resolver favors POSIX path, while commonjs plugin (and maybe others?) uses native path as module id. This can result in `namedExports` being ignored if rollup happened to use typescript's resolution. Set to true to pass resolved module path through `resolve()` to match up with `rollup-plugin-commonjs`. 

### Watch mode

The way typescript handles type-only imports and ambient types effectively hides them from rollup watch, because import statements are not generated and changing them doesn't trigger a rebuild.

Otherwise the plugin should work in watch mode. Make sure to run a normal build after watch session to catch any type errors. 

### Version

This plugin currently requires TypeScript `2.0+`.

### Rollup version

Tested on rollup `0.41.4`.

### Reporting bugs

Report any bugs on github: <https://github.com/ezolenko/rollup-plugin-typescript2/issues>.

Attach your `tsconfig.json`, `package.json` (for versions of dependencies), rollup script and anything else that could influence module resolution, ambient types and typescript compilation.

Check if problem is reproducible after running `npm prune` to clear any rogue types from npm_modules (by default typescript grabs all ambient types).

Check if you get the same problem with `clean` option set to true (might indicate a bug in the cache).

If makes sense, check if running `tsc` directly produces similar results.

Attach plugin output with `verbosity` option set to 3 (this will list all files being transpiled and their imports).
