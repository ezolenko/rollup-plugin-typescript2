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

While this repo now has an assortment of unit tests and integration tests, it still needs more integration tests with various scenarios and expected outcomes.

### Building and Self-Build

One can test changes by doing a self-build; the plugin is part of its own build system.

1. make changes
1. run `npm run build` (uses last released version on npm)
1. check that you get expected changes in `dist`
1. run `npm run build-self` (uses fresh local build)
1. check `dist` for the expected changes
1. run `npm run build-self` _again_ to make sure plugin built by new version can still build itself

If `build-self` breaks at some point, fix the problem and restart from the `build` step (a known good copy).

## Learning the codebase

If you're looking to learn more about the codebase, either to contribute or just to educate yourself, this section contains an outline as well as tips and useful resources.<br />
These docs have been written by contributors who have gone through the process of learning the codebase themselves!

### General Overview

Before starting, make sure you're familiar with the [`README`](README.md) in its entirety, as it describes this plugin's options that make up its API surface.<br />
It can also be useful to review some issues and have a "goal" in mind (especially if you're looking to contribute), so that you can focus on understanding how a certain part of the codebase works.

1. Can read [`get-options-overrides`](src/get-options-overrides.ts) as a quick intro to the codebase that dives a bit deeper into the `compilerOptions` that this plugin forces.
    - The [TSConfig Reference](https://www.typescriptlang.org/tsconfig) can be a helpful resource to understand these options.
1. Get a _quick_ read-through of [`index`](src/index.ts) (which is actually relatively small), to get a general understanding of this plugin's workflow.
    - Rollup's [Plugin docs](https://rollupjs.org/guide/en/#plugins-overview) are _very_ helpful to reference as you're going through, especially if you're not familiar with the Rollup Plugin API.

### Deeper Dive

Once you have some understanding of the codebase's main workflow, you can start to dive deeper into pieces that require more domain knowledge.<br />
A useful resource as you dive deeper are the [unit tests](__tests__/). They're good to look through as you dig into a module to understand how it's used.

1. From here, you can start to read more of the modules that integrate with the TypeScript API, such as [`host`](src/host.ts) and [`parse-tsconfig`](src/parse-tsconfig.ts), and maybe how TS is imported in [`tsproxy`](src/tsproxy.ts) and [`tslib`](src/tslib.ts)
    - A _very_ useful reference here is the [TypeScript Wiki](https://github.com/microsoft/TypeScript/wiki), which has two main articles that are the basis for most Compiler integrations:
      - [Using the Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
      - [Using the Language Service API](https://github.com/microsoft/TypeScript/wiki/Using-the-Language-Service-API)
      - _NOTE_: These are fairly short and unfortunately leave a lot to be desired... especially when you consider that this plugin is actually one of the simpler integrations out there.
1. At this point, you may be ready to read the more complicated bits of [`index`](src/index.ts) in detail and see how it interacts with the other modules.
    - The [integration tests](__tests__/integration/) could be useful to review at this point as well.
1. Once you're pretty familiar with `index`, you can dive into some of the cache code in [`tscache`](src/tscache.ts) and [`rollingcache`](src/rollingcache.ts).
1. And finally, you can see some of the Rollup logging nuances in [`context`](src/context.ts) and then the TS logging nuances in [`diagnostics`](src/diagnostics.ts), and [`diagnostics-format-host`](src/diagnostics-format-host.ts)
    - While these are necessary to the implementation, they are fairly ancillary to understanding and working with the codebase.
