const _ = require('lodash');
const df = require('./default.cjs');

function mapEnvConfig (object, prefix = '') {
	return _.mapValues(object, (value, key) => {
		const currentKey = (prefix ? `${prefix}_` : '') + _.snakeCase(key).toUpperCase();

		if (_.isObject(value)) {
			return mapEnvConfig(value, currentKey);
		}

		if (typeof value === 'number' || typeof value === 'boolean') {
			return {
				__name: currentKey,
				__format: typeof value,
			};
		}

		return currentKey;
	});
}

const mapped = mapEnvConfig(df);

module.exports = mapped;
