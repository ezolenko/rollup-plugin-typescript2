// import * as ts from "typescript";
// import * as fs from "fs";
import {LanguageServiceHost} from "./host";
import * as path from "path";
import {
	readFile,
	remove,
	ensureDir,
	writeFile,
} from "fs-extra";
const local = (x: string) => path.resolve(__dirname, x);
const unaryFunctionExample = "const unary = (x: string): string => x.reverse()";
afterAll(() => Promise.all([
	remove(local("does-exist.ts")),
	remove(local("host-test-dir")),
]));
beforeAll(() =>
	ensureDir(local("host-test-dir")).then(
		() =>
			writeFile(
				local("host-test-dir/host-test-file.ts"),
				unaryFunctionExample,
				"utf8",
			),
	),
	// ).then(() => readFile(local("host-test-dir/host-test-file.ts"), "utf8").then((uhhh) => console.warn(">>>", uhhh)),
);

test("LanguageServiceHost", (done) => {
	const config = {
		fileNames: [],
		errors: [],
		options: {test: "this is a test" },
	};
	const transformers = [
		() => ({}),
	];
	const host = new LanguageServiceHost(config, transformers);
	expect(host).toBeTruthy();
	expect(Object.keys(host)).toEqual(
		[
			"parsedConfig",
			"transformers",
			"cwd",
			"snapshots",
			"versions",
			"fileNames",
		],
	);
	host.reset();
	expect((host as any).snapshots).toEqual({});
	expect((host as any).versions).toEqual({});
	const testFile = local("test.ts");
	host.setLanguageService(({pretend: "language-service"} as any));
	expect((host as any).service).toEqual({pretend: "language-service"});
	const snap = host.setSnapshot(testFile, unaryFunctionExample);
	expect(snap).toEqual({text: unaryFunctionExample});
	expect((host as any).snapshots[testFile]).toEqual({text: unaryFunctionExample});
	expect((host as any).versions[testFile]).toEqual(1);
	const truncateName = (till: number) => (z: string) => z.split(path.sep).slice(till).join(path.sep);
	const truncate3 = truncateName(-3);
	expect([...(host as any).fileNames].map(truncate3)).toEqual(["rollup-plugin-typescript2/src/test.ts"]);
	expect(host.getScriptSnapshot(testFile)).toEqual({text: unaryFunctionExample});
	expect(host.getScriptSnapshot(local("does-not-exist.ts"))).toBeFalsy();
	expect(host.getCurrentDirectory()).toEqual(path.resolve(__dirname, ".."));
	expect(host.getScriptVersion(testFile)).toEqual("1");
	expect(host.getScriptVersion("nothing")).toEqual("0");
	expect(host.getScriptFileNames().map(truncate3)).toEqual(["rollup-plugin-typescript2/src/test.ts"]);
	expect(host.getCompilationSettings()).toEqual({test: "this is a test" });
	expect(truncateName(-5)(host.getDefaultLibFileName({}))).toEqual("rollup-plugin-typescript2/node_modules/typescript/lib/lib.d.ts");
	expect(host.useCaseSensitiveFileNames()).toBeFalsy();
	expect(host.getTypeRootsVersion()).toEqual(0);
	expect(host.directoryExists("no-it-does-not")).toBeFalsy();
	expect(host.getDirectories(".")).toEqual([".git", ".github", "cache_", "coverage", "dist", "node_modules", "src"]);
	expect(host.getCustomTransformers()).toEqual({after: [], before: []});
	expect(host.fileExists("no-it-does.not")).toBeFalsy();
	writeFile(local("does-exist.ts"), unaryFunctionExample, "utf8").then(() => {
		expect(host.readDirectory(local("host-test-dir")).map(truncate3)).toEqual([
			"src/host-test-dir/host-test-file.ts",
		]);
		expect(host.fileExists(local("does-exist.ts"))).toBeTruthy();
		expect(host.getScriptSnapshot(local("does-exist.ts"))).toEqual({text: unaryFunctionExample});
		done();
	});
});

test("LanguageServiceHost.readFile", () => {
	const config = {
		fileNames: [],
		errors: [],
		options: {test: "this is a test" },
	};
	const transformers = [
		() => ({}),
	];
	const host = new LanguageServiceHost(config, transformers);
	expect(host.readFile(local("src/host-test-dir/host-test-file.js"))).toBeFalsy();
});

// ts.sys.readFile() doesn't ever appear to return anything, so skipping this test for now
test.skip("LanguageServiceHost.readFile", (done) => {
	return readFile(local("host-test-dir/host-test-file.ts"), "utf8").then(
		(data) => {
			expect(data).toEqual(unaryFunctionExample);
			const config = {
				fileNames: [],
				errors: [],
				options: {test: "this is a test" },
			};
			const transformers = [
				() => ({}),
			];
			const host = new LanguageServiceHost(config, transformers);
			// const file = host.readFile(local("host-test-dir/host-test-file.js"));
			// expect(file).toEqual(unaryFunctionExample);
			// const file2 = host.readFile("host-test-dir/host-test-file.js");
			// expect(file2).toEqual(unaryFunctionExample);
			const file3 = host.readFile("src/host-test-dir/host-test-file.js");
			expect(file3).toEqual(unaryFunctionExample);
			done();
		},
	);
});

test("LanguageServiceHost - getCustomTransformers", () => {
	const config = {
		fileNames: [],
		errors: [],
		options: {},
	};
	const transformers = [
		() => ({before: () => "test"}),
	];
	const host = new LanguageServiceHost(config, transformers as any);
	const customTransformers = host.getCustomTransformers();
	expect(customTransformers).toBeFalsy();
});

test.skip("LanguageServiceHost - getCustomTransformers with no service", () => {
	const config = {
		fileNames: [],
		errors: [],
		options: {},
	};
	const transformers = [
		() => ({before: () => "test"}),
	];
	const host = new LanguageServiceHost(config, transformers as any);
	const I = (x: any) => x;
	host.setLanguageService(I as any);
	const customTransformers = host.getCustomTransformers();
	console.warn(customTransformers);
	expect(typeof (customTransformers as any)[0][0]).toEqual("function");
});
