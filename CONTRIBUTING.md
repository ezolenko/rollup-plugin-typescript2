# Contributing

## Reporting bugs

Report any bugs [in the GitHub Issue Tracker](https://github.com/ezolenko/rollup-plugin-typescript2/issues).

Please follow the issue template as closely as possible:

- Attach your `tsconfig.json`, `package.json` (for versions of dependencies), `rollup.config.js`, and any other pieces of your environment that could influence module resolution, ambient types, and TS compilation.

Some additional debugging steps you can take to help diagnose the issue:

- Attach plugin output with `verbosity` option set to `3` (this will list all files being transpiled and their imports).
- If it makes sense, check if running `tsc` directly produces similar results.
- Check if you get the same problem with `clean` option set to `true` (might indicate a bug in the cache).
- Check if the problem is reproducible after running `npm prune` to clear any rogue types from `node_modules` (by default TS grabs _all_ ambient types).

## Developing

Use the [standard GitHub process](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/about-collaborative-development-models#fork-and-pull-model) of forking, making a branch, creating a PR when ready, and fixing any failing checks on the PR.

### Linting and Style

1. Use an editor that supports [`editorconfig`](https://editorconfig.org/), or match the settings from [`.editorconfig`](./.editorconfig) manually.
1. Fix all linting problems with `npm run lint`.

### Testing

1. `npm test` to verify that all tests pass
1. `npm run test:watch` to run tests in watch mode while developing
1. `npm run test:coverage` to run tests and output a test coverage report

While this repo now has an assortment of unit tests, it still badly needs integration tests with various scenarios and expected outcomes.
Test coverage improvements for existing files and untested is needed as well.

### Building and Self-Build

One can test changes by doing a self-build; the plugin is part of its own build system.

1. make changes
1. run `npm run build` (uses last released version on npm)
1. check that you get expected changes in `dist`
1. run `npm run build-self` (uses fresh local build)
1. check `dist` for the expected changes
1. run `npm run build-self` _again_ to make sure plugin built by new version can still build itself

If `build-self` breaks at some point, fix the problem and restart from the `build` step (a known good copy).
