import { ConsoleContext } from "../src/context";

(global as any).console = {log: jest.fn()};

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

	expect((proxy as any).prefix).toEqual("=>");
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

	expect((proxy as any).prefix).toEqual("");
});
