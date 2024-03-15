export default function wallaby () {
	return {
		testFramework: 'mocha',
		files: [
			'config/*',
			'public/v1/*',
			'public/**/*.yaml',
			'test/plugins/**/*',
			'test/tests/e2e/setup-probe.ts',
			'test/tests/e2e/utils.ts',
			'test/tests/e2e/docker.ts',
			'src/**/*.ts',
			'knexfile.js',
			'package.json',
		],
		tests: [
			'test/tests/e2e/**/*.test.ts',
		],

		setup (w) {
			const path = require('path');
			w.testFramework.addFile(path.resolve(process.cwd(), 'test/tests/e2e/setup-probe.js'));
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
