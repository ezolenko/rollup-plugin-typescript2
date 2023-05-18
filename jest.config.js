const pkg = require("./package.json");

/** @type {import("ts-jest").InitialOptionsTsJest} */
const config = {
	// ts-jest settings
	preset: "ts-jest/presets/js-with-ts",
	globals: {
		// other globals (unrelated to ts-jest) -- these are namespaced so they don't conflict with anything else
		"rpt2__TS_VERSION_RANGE": pkg.peerDependencies.typescript,
		"rpt2__ROLLUP_VERSION_RANGE": pkg.peerDependencies.rollup,
		"rpt2__RPT2_VERSION": pkg.version,
	},
	transform: {
		"<rootdir>/__tests__/*.ts": ["ts-jest", {
			tsconfig: "./tsconfig.test.json",
		}],
	},

	// jest settings
	injectGlobals: false, // use @jest/globals instead
	restoreMocks: true,
	// only use *.spec.ts files in __tests__, no auto-generated files
	testMatch: ["**/__tests__/**/*.spec.ts?(x)"],
	coveragePathIgnorePatterns: [
		"node_modules", // default
		"<rootDir>/__tests__/" // ignore any test helper files
	],
	moduleDirectories: ["node_modules", "<rootdir>/src/"],
};

module.exports = config;
