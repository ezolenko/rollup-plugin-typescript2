/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  preset: 'ts-jest',
  injectGlobals: false, // use @jest/globals instead
  restoreMocks: true,
  // only use *.spec.ts files in __tests__, no auto-generated files
  testMatch: ["**/__tests__/**/*.spec.ts?(x)"]
};

module.exports = config;
