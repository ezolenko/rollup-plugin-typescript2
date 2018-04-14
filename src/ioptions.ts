import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";

export interface IOptions
{
	include: string|string[];
	exclude: string|string[];
	check: boolean;
	verbosity: number;
	clean: boolean;
	cacheRoot: string;
	abortOnError: boolean;
	rollupCommonJSResolveHack: boolean;
	tsconfig?: string;
	useTsconfigDeclarationDir: boolean;
	typescript: typeof tsModule;
	tsconfigOverride: any;
	transformers: (service: tsTypes.LanguageService) => tsTypes.CustomTransformers;
	tsconfigDefaults: any;
	sourceMapCallback: (id: string, map: string) => void;
}
