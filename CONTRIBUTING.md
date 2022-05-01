# Contributing

## Reporting bugs

Report any bugs on github: <https://github.com/ezolenko/rollup-plugin-typescript2/issues>.

Attach your `tsconfig.json`, `package.json` (for versions of dependencies), rollup script and anything else that could influence module resolution, ambient types and typescript compilation.

Check if problem is reproducible after running `npm prune` to clear any rogue types from npm_modules (by default typescript grabs all ambient types).

Check if you get the same problem with `clean` option set to true (might indicate a bug in the cache).

If makes sense, check if running `tsc` directly produces similar results.

Attach plugin output with `verbosity` option set to 3 (this will list all files being transpiled and their imports).

## Developing

Use the normal github process of forking, making a branch and creating a PR when ready. Fix all linting problems (run `npm lint`), fix any failed checks that are run on the PR (basically lint right now). Use an editor that supports editorconfig, or match the settings from `.editorconfig` file manually.

Fastest way to test changes is to do a self build, the plugin is part of its own build system:
- make changes
- run `npm build` (uses last released version on npm)
- check that you get expected changes in `dist`
- run `npm build-self` (uses fresh local build)
- check `dist` for the expected changes
- run `npm build-self` _again_ to make sure plugin built by new version can still build itself

If `build-self` breaks at some point, fix the problem and restart from `build` step (a known good copy).

This repo badly needs unittests and integration tests with various scenarios and expected outcomes though.
