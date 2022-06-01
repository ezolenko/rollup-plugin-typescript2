import * as tsTypes from "typescript";

import { tsModule } from "./tsproxy";

export function checkTsConfig(parsedConfig: tsTypes.ParsedCommandLine): void
{
	const module = parsedConfig.options.module!;

	if (module !== tsModule.ModuleKind.ES2015 && module !== tsModule.ModuleKind.ESNext && module !== tsModule.ModuleKind.ES2020)
		throw new Error(`Incompatible tsconfig option. Module resolves to '${tsModule.ModuleKind[module]}'. This is incompatible with rollup, please use 'module: "ES2015"' or 'module: "ESNext"'.`);
}
