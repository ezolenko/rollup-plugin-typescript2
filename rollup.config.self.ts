import ts from "./build-self/index";

import config from "./rollup.config.base";

config.plugins.push(ts({ verbosity: 2, abortOnError: false, clean: false }));

export default config;
