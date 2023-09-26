/* eslint-env node */
module.exports = {
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	root: true,
	ignorePatterns: ['dist/**', 'node_modules/**', 'build-self/**', '*.js', "__tests__/integration/fixtures/errors/**"],
	rules: {
		"@typescript-eslint/no-explicit-any": "off",
	}
};