/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  restoreMocks: true,
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  modulePaths: [
    "src"
  ],
  moduleDirectories: [
    "node_modules",
    "src"
  ],
  coveragePathIgnorePatterns: [],
  moduleFileExtensions: [
    "js",
    "ts",
    "json"
  ],
  testMatch: [
    "**/*.spec.ts"
  ],
};

module.exports = config;
