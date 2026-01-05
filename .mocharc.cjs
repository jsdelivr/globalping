process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'unit';

if (process.env.TS_NODE_TRANSPILE_ONLY === undefined) {
	process.env.TS_NODE_TRANSPILE_ONLY = 'true';
}

module.exports = {
	'exit': true,
	'timeout': 20000,
	'check-leaks': true,
	'file': [
		'test/setup.ts',
	],
	'node-option': [
		'enable-source-maps',
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
