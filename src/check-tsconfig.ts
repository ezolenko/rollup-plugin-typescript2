import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";

export function checkTsConfig(parsedConfig: tsTypes.ParsedCommandLine): void
{
	const module = parsedConfig.options.module;

	switch (module)
	{
		case tsModule.ModuleKind.ES2015:
		case tsModule.ModuleKind.ESNext:
			break;
		case undefined:
			throw new Error(`Incompatible tsconfig option. Missing module option. This is incompatible with rollup, please use 'module: "ES2015"' or 'module: "ESNext"'.`);
		default:
			throw new Error(`Incompatible tsconfig option. Module resolves to '${tsModule.ModuleKind[module]}'. This is incompatible with rollup, please use 'module: "ES2015"' or 'module: "ESNext"'.`);
	}
}
