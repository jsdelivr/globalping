import { defineConfig } from 'eslint/config';
import typescript from '@martin-kolarik/eslint-config/typescript.js';
import typescriptTypeChecked from '@martin-kolarik/eslint-config/typescript-type-checked.js';

export default defineConfig([
	typescript,
	{
		ignores: [
			'coverage/**/*',
			'data/**/*',
			'dist/**/*',
			'.geo-data-tests/**',
		],
	},
	{
		files: [ 'src/**/*.ts' ],
		extends: [ typescriptTypeChecked ],

		languageOptions: {
			sourceType: 'module',

			parserOptions: {
				project: true,
			},
		},
	},
	{
		rules: {
			'no-duplicate-imports': 'off',
			'@stylistic/no-extra-parens': 'off',
		},
	},
	{
		files: [ 'public/**' ],

		languageOptions: {
			sourceType: 'script',
		},

		rules: {
			'no-undef': 'off',
			'no-unused-vars': 'off',
		},
	},
	{
		files: [ 'test/**' ],

		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',

			'no-restricted-properties': [ 'error',
				{
					object: 'sinon',
					property: 'spy',
				},
				{
					object: 'sinon',
					property: 'stub',
				},
				{
					object: 'sinon',
					property: 'mock',
				},
				{
					object: 'sinon',
					property: 'fake',
				},
				{
					object: 'sinon',
					property: 'restore',
				},
				{
					object: 'sinon',
					property: 'reset',
				},
				{
					object: 'sinon',
					property: 'resetHistory',
				},
				{
					object: 'sinon',
					property: 'resetBehavior',
				}],
		},
	},
]);
