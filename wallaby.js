import * as path from 'node:path';
import * as url from 'node:url';

export default function w (wallaby) {
	const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

	return {
		testFramework: 'mocha',
		files: [
			'public/v1/*',
			'src/**/*.ts',
			'src/**/*.cjs',
			'src/**/*.json',
			'config/*',
			'public/**/*.yaml',
			'seeds/**/*',
			'migrations/**/*',
			'test/utils/**/*.ts',
			'test/mocks/**/*',
			'test/plugins/**/*',
			'test/setup.ts',
			'test/types.ts',
			'package.json',
			'knexfile.js',
			'data/*',
		],
		tests: [
			'test/tests/integration/**/*.test.ts',
			'test/tests/unit/**/*.test.ts',
		],
		setup (w) {
			const path = require('path');
			w.testFramework.files.unshift(path.resolve(process.cwd(), 'test/setup.js'));
			const mocha = w.testFramework;
			mocha.timeout(10000);
		},
		env: {
			type: 'node',
			params: {
				runner: '--experimental-specifier-resolution=node --loader '
					+ url.pathToFileURL(path.join(__dirname, 'node_modules/testdouble/lib/index.mjs')),
				env: 'NODE_ENV=test;TEST_MODE=unit',
			},
		},
		compilers: {
			'**/*.ts?(x)': wallaby.compilers.typeScript({
				module: 'ESNext',
			}),
		},
		preprocessors: {
			'**/*.ts': file => file.content.replace(/\.ts/g, '.js'),
		},
		workers: { restart: true, initial: 1, regular: 1 },
		runMode: 'onsave',
	};
}
