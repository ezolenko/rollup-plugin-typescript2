/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  preset: 'ts-jest',
  injectGlobals: false, // use @jest/globals instead
  restoreMocks: true,
};

module.exports = config;
