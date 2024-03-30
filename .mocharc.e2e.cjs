const path = require('path');

module.exports = {
	'exit': true,
	'timeout': 20000,
	'check-leaks': true,
	'file': [
		path.join(__dirname, 'test/e2e/setup.ts'),
	],
	'spec': [
		path.join(__dirname, 'test/e2e/cases/**/*.test.ts'),
	],
	'node-option': [
		'experimental-specifier-resolution=node',
		'loader=ts-node/esm',
	],
	'globals': [
		'__extends',
		'__assign',
		'__rest',
		'__decorate',
		'__param',
		'__metadata',
		'__awaiter',
		'__generator',
		'__exportStar',
		'__createBinding',
		'__values',
		'__read',
		'__spread',
		'__spreadArrays',
		'__spreadArray',
		'__await',
		'__asyncGenerator',
		'__asyncDelegator',
		'__asyncValues',
		'__makeTemplateObject',
		'__importStar',
		'__importDefault',
		'__classPrivateFieldGet',
		'__classPrivateFieldSet',
	],
};
