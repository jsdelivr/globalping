export default function wallaby () {
	return {
		testFramework: 'mocha',
		files: [
			'config/*',
			'public/v1/*',
			'public/**/*.yaml',
			'test/plugins/**/*',
			'test/e2e/client.ts',
			'test/e2e/setup.ts',
			'test/e2e/utils.ts',
			'test/e2e/docker.ts',
			'src/**/*.ts',
			'migrations/*',
			'seeds/**/*',
			'knexfile.js',
			'package.json',
		],
		tests: [
			'test/e2e/**/*.test.ts',
		],

		setup (w) {
			const path = require('path');
			w.testFramework.addFile(path.resolve(process.cwd(), 'test/e2e/setup.js'));
			w.testFramework.timeout(20000);
		},

		env: {
			type: 'node',
			params: {
				env: 'NODE_ENV=test',
			},
		},
		workers: { restart: true, initial: 1, regular: 1 },
		runMode: 'onsave',
	};
}
