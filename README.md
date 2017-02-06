# rollup-plugin-typescript2
![npm-version](https://img.shields.io/npm/v/rollup-plugin-typescript2.svg?maxAge=2592000)
![npm-dependencies](https://img.shields.io/david/ezolenko/rollup-plugin-typescript2.svg?maxAge=2592000)

Rollup plugin for typescript with compiler errors. 

This is a rewrite of original rollup-plugin-typescript, starting and borrowing from [this fork](https://github.com/alexlur/rollup-plugin-typescript).

This version is significantly slower than original, but it will print out typescript errors and warnings.

## Usage

```js
// rollup.config.js
import typescript from 'rollup-plugin-typescript';

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

Plugin itself takes standard include/exclude options (each a minimatch pattern, or array of minimatch patterns), which determine which files are transpiled by Typescript (all `.ts` and `.tsx` files by default)

### TypeScript version
This plugin currently requires TypeScript > 2.0.
