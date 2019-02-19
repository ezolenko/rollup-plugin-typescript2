import * as tsTypes from "typescript";
export function checkTsConfig(parsedConfig: tsTypes.ParsedCommandLine): void
{
	const module = parsedConfig.options.module!;

	if (module !== tsTypes.ModuleKind.ES2015 && module !== tsTypes.ModuleKind.ESNext)
		throw new Error(`Incompatible tsconfig option. Module resolves to '${tsTypes.ModuleKind[module]}'. This is incompatible with rollup, please use 'module: "ES2015"' or 'module: "ESNext"'.`);
}
