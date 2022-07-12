import * as tsTypes from "typescript";

import { tsModule } from "./tsproxy";

export function checkTsConfig(parsedConfig: tsTypes.ParsedCommandLine): void
{
	const module = parsedConfig.options.module!;

	if (module !== tsModule.ModuleKind.ES2015 && module !== tsModule.ModuleKind.ES2020 && module !== tsModule.ModuleKind.ESNext)
		throw new Error(`rpt2: Incompatible tsconfig option. Module resolves to '${tsModule.ModuleKind[module]}'. This is incompatible with Rollup, please use 'module: "ES2015"', 'module: "ES2020"', or 'module: "ESNext"'.`);
}
