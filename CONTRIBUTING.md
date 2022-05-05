# Contributing

## Reporting bugs

Report any bugs [in the GitHub Issue Tracker](https://github.com/ezolenko/rollup-plugin-typescript2/issues).

Attach your `tsconfig.json`, `package.json` (for versions of dependencies), `rollup.config.js`, and anything else that could influence module resolution, ambient types, and TS compilation.

Check if the problem is reproducible after running `npm prune` to clear any rogue types from `node_modules` (by default TS grabs _all_ ambient types).

Check if you get the same problem with `clean` option set to `true` (might indicate a bug in the cache).

If it makes sense, check if running `tsc` directly produces similar results.

Attach plugin output with `verbosity` option set to 3 (this will list all files being transpiled and their imports).

## Developing

Use the [standard GitHub process](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/about-collaborative-development-models#fork-and-pull-model) of forking, making a branch, and creating a PR when ready. Fix all linting problems (`npm run lint`) and fix any failed checks on the PR. Use an editor that supports [`editorconfig`](https://editorconfig.org/), or match the settings from [`.editorconfig`](./.editorconfig) manually.

Fastest way to test changes is to do a self build; the plugin is part of its own build system:

1. make changes
1. run `npm run build` (uses last released version on npm)
1. check that you get expected changes in `dist`
1. run `npm run build-self` (uses fresh local build)
1. check `dist` for the expected changes
1. run `npm run build-self` _again_ to make sure plugin built by new version can still build itself

If `build-self` breaks at some point, fix the problem and restart from the `build` step (a known good copy).

This repo badly needs unit tests and integration tests with various scenarios and expected outcomes though.
