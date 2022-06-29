/** @type {import("ts-jest").InitialOptionsTsJest} */
const config = {
	// ts-jest settings
	preset: "ts-jest",
	globals: {
		"ts-jest": {
			tsconfig: "./tsconfig.test.json",
		}
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
};

module.exports = config;
