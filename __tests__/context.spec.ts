import { jest, test, expect } from "@jest/globals";

import { makeContext } from "./fixtures/context";
import { ConsoleContext, RollupContext } from "../src/context";

(global as any).console = {
	warn: jest.fn(),
	log: jest.fn(),
	info: jest.fn(),
};

test("ConsoleContext", () => {
	const proxy = new ConsoleContext(6, "=>");

	proxy.warn("test");
	expect(console.log).toHaveBeenLastCalledWith("=>test");

	proxy.error("test2");
	expect(console.log).toHaveBeenLastCalledWith("=>test2");

	proxy.info("test3");
	expect(console.log).toHaveBeenLastCalledWith("=>test3");

	proxy.debug("test4");
	expect(console.log).toHaveBeenLastCalledWith("=>test4");

	proxy.warn(() => "ftest");
	expect(console.log).toHaveBeenLastCalledWith("=>ftest");

	proxy.error(() => "ftest2");
	expect(console.log).toHaveBeenLastCalledWith("=>ftest2");

	proxy.info(() => "ftest3");
	expect(console.log).toHaveBeenLastCalledWith("=>ftest3");

	proxy.debug(() => "ftest4");
	expect(console.log).toHaveBeenLastCalledWith("=>ftest4");
});

test("ConsoleContext 0 verbosity", () => {
	const proxy = new ConsoleContext(-100);

	proxy.warn("no-test");
	expect(console.log).not.toHaveBeenLastCalledWith("no-test");

	proxy.info("no-test2");
	expect(console.log).not.toHaveBeenLastCalledWith("no-test2");

	proxy.debug("no-test3");
	expect(console.log).not.toHaveBeenLastCalledWith("no-test3");

	proxy.error("no-test4");
	expect(console.log).not.toHaveBeenLastCalledWith("no-test4");
});

test("RollupContext", () => {
	const innerContext = makeContext();
	const context = new RollupContext(5, false, innerContext);

	context.warn("test");
	expect(innerContext.warn).toHaveBeenLastCalledWith("test");

	context.warn(() => "test2");
	expect(innerContext.warn).toHaveBeenLastCalledWith("test2");

	context.error("test!");
	expect(innerContext.warn).toHaveBeenLastCalledWith("test!");

	context.error(() => "test2!");
	expect(innerContext.warn).toHaveBeenLastCalledWith("test2!");

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
	const innerContext = makeContext();
	const context = new RollupContext(0, false, innerContext);

	context.debug("verbosity is too low here");
	expect(innerContext.debug).not.toBeCalled();
	context.info("verbosity is too low here");
	expect(innerContext.debug).not.toBeCalled();
	context.warn("verbosity is too low here")
	expect(innerContext.warn).not.toBeCalled();
});

test("RollupContext.error + debug negative verbosity", () => {
	const innerContext = makeContext();
	const context = new RollupContext(-100, true, innerContext);

	context.error("verbosity is too low here");
	expect(innerContext.error).not.toBeCalled();
	context.debug("verbosity is too low here");
	expect(innerContext.debug).not.toBeCalled();
});

test("RollupContext.error with bail", () => {
	const innerContext = makeContext();
	const context = new RollupContext(5, true, innerContext);

	context.error("bail");
	expect(innerContext.error).toHaveBeenLastCalledWith("bail");
});
