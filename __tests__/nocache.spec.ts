import { NoCache } from "../src/nocache";

test("NoCache", () => {
	const noCache = new NoCache();

	expect(noCache.exists("")).toBeFalsy();
	expect(noCache.path("x")).toEqual("x");
	expect(noCache.match([])).toBeFalsy();
	expect(noCache.read("x")).toEqual(undefined);
	expect(noCache.write("", {})).toBeFalsy();
	expect(noCache.touch("")).toBeFalsy();
	expect(noCache.roll()).toBeFalsy();
});
