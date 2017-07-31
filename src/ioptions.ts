export interface IOptions
{
	include: string;
	exclude: string;
	check: boolean;
	verbosity: number;
	clean: boolean;
	cacheRoot: string;
	abortOnError: boolean;
	rollupCommonJSResolveHack: boolean;
	tsconfig: string;
	useTsconfigDeclarationDir: boolean;
}
