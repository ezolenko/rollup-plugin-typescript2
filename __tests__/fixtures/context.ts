import { PluginContext } from "rollup";

import { IContext } from "../../src/context";

const stub = (x: any) => x;

const contextualLogger = (data: any): IContext => {
	return {
		warn: (x: any) => {
			data.warn = x;
		},
		error: (x: any) => {
			data.error = x;
		},
		info: (x: any) => {
			data.info = x;
		},
		debug: (x: any) => {
			data.debug = x;
		},
	};
};

export function makeStubbedContext (data: any): PluginContext & IContext {
	const { warn, error, info, debug } = contextualLogger(data);
	return {
		addWatchFile: stub as any,
		getWatchFiles: stub as any,
		cache: stub as any,
		load: stub as any,
		resolve: stub as any,
		resolveId: stub as any,
		isExternal: stub as any,
		meta: stub as any,
		emitAsset: stub as any,
		emitChunk: stub as any,
		emitFile: stub as any,
		setAssetSource: stub as any,
		getAssetFileName: stub as any,
		getChunkFileName: stub as any,
		getFileName: stub as any,
		parse: stub as any,
		warn: warn as any,
		error: error as any,
		info: info as any,
		debug: debug as any,
		moduleIds: stub as any,
		getModuleIds: stub as any,
		getModuleInfo: stub as any
	};
};
