import ts from "rollup-plugin-typescript2";

import config from "./rollup.config.base";

config.plugins.push(ts({ verbosity: 2, abortOnError: false, include: ["*.ts{,x}", "**/*.ts{,x}", "**/*.cts", "**/*.mts"] }));

export default config;
