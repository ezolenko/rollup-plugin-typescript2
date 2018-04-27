import { tsModule } from "./tsproxy";
import * as tsTypes from "typescript";

export type TransformerFactoryCreator = (ls: tsTypes.LanguageService) => tsTypes.CustomTransformers;

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
	transformers: TransformerFactoryCreator[];
	tsconfigDefaults: any;
	sourceMapCallback: (id: string, map: string) => void;
}
