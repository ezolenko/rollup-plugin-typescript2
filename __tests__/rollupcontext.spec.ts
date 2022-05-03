import { jest, test, expect } from "@jest/globals";

import { RollupContext } from "../src/rollupcontext";

(global as any).console = {
	warn: jest.fn(),
	log: jest.fn(),
	info: jest.fn(),
};

const stub = (x: any) => x;
const contextualLogger = (data: any) => {
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
	};
};
const makeStubbedContext = (data: any) => {
	const {info, warn, error} = contextualLogger(data);
	return {
		addWatchFile: stub as any,
		cache: stub as any,
		resolveId: stub as any,
		isExternal: stub as any,
		meta: stub as any,
		emitAsset: stub as any,
		setAssetSource: stub as any,
		getAssetFileName: stub as any,
		parse: stub as any,
		warn,
		error,
		info,
		moduleIds: stub as any,
		getModuleInfo: stub as any,
		watcher: {
			addListener: stub as any,
			on: stub as any,
			once: stub as any,
			prependListener: stub as any,
			prependOnceListener: stub as any,
			removeListener: stub as any,
			removeAllListeners: stub as any,
			setMaxListeners: stub as any,
			getMaxListeners: stub as any,
			listeners: stub as any,
			emit: stub as any,
			eventNames: stub as any,
			listenerCount: stub as any,
		},
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
	delete stubbedContext.warn;
	delete stubbedContext.error;
	delete stubbedContext.info;

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
	const context2 = new RollupContext(0, false, stubbedContext);

	expect(context2.info("verbosity is too low here")).toBeFalsy();
	expect(context2.warn("verbosity is too low here")).toBeFalsy();
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
