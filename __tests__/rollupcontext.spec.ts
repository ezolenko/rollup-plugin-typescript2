import { jest, test, expect } from "@jest/globals";
import { PluginContext } from "rollup";

import { IContext } from "../src/context";
import { RollupContext } from "../src/rollupcontext";

(global as any).console = {
	warn: jest.fn(),
	log: jest.fn(),
	info: jest.fn(),
};

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
const makeStubbedContext = (data: any): PluginContext & IContext => {
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

test("RollupContext", () => {
	const data = {};
	const stubbedContext = makeStubbedContext(data);

	const context = new RollupContext(5, false, stubbedContext);
	expect(Object.keys(context)).toEqual(["verbosity", "bail", "context", "prefix", "hasContext"]);

	context.warn("test");
	expect((data as any).warn).toEqual("test");

	context.warn(() => "test2");
	expect((data as any).warn).toEqual("test2");

	context.error("test!");
	expect((data as any).warn).toEqual("test!");

	context.error(() => "test2!");
	expect((data as any).warn).toEqual("test2!");
});

test("RollupContext with no logger", () => {
	const data = {};
	const stubbedContext = makeStubbedContext(data);
	delete (stubbedContext as any).warn;
	delete (stubbedContext as any).error;
	delete (stubbedContext as any).info;
	delete (stubbedContext as any).debug;

	const context = new RollupContext(5, false, stubbedContext);

	context.warn("test");
	expect(console.log).toHaveBeenLastCalledWith("test");

	context.error("test2");
	expect(console.log).toHaveBeenLastCalledWith("test2");

	context.info("test3");
	expect(console.log).toHaveBeenLastCalledWith("test3");

	context.info(() => "test4");
	expect(console.log).toHaveBeenLastCalledWith("test4");

	context.debug("test5");
	expect(console.log).toHaveBeenLastCalledWith("test5");

	context.debug(() => "test6");
	expect(console.log).toHaveBeenLastCalledWith("test6");
});

test("RollupContext with 0 verbosity", () => {
	const data = {};
	const stubbedContext = makeStubbedContext(data);
	const context = new RollupContext(0, false, stubbedContext);

	expect(context.debug("verbosity is too low here")).toBeFalsy();
	expect(context.info("verbosity is too low here")).toBeFalsy();
	expect(context.warn("verbosity is too low here")).toBeFalsy();
});

test("RollupContext.error + debug negative verbosity", () => {
	const data = {};
	const stubbedContext = makeStubbedContext(data);
	const context = new RollupContext(-100, true, stubbedContext);

	expect(context.error("whatever")).toBeFalsy();
	expect(context.debug("whatever")).toBeFalsy();
});

test("RollupContext.error with bail", () => {
	const data = {};
	const stubbedContext = makeStubbedContext(data);
	const context = new RollupContext(5, true, stubbedContext);

	expect(context.error("whatever")).toBeFalsy();
	expect((data as any).error).toEqual("whatever");
});
