const _ = require('lodash');
const df = require('./default.cjs');

function mapEnvConfig (object, prefix = '') {
	return _.mapValues(object, (value, key) => {
		if (_.isObject(value)) {
			return mapEnvConfig(value, (prefix ? `${prefix}_` : '') + _.snakeCase(key).toUpperCase());
		}

		return {
			__name: (prefix ? `${prefix}_` : '') + _.snakeCase(key).toUpperCase(),
			...(typeof value === 'number' && { __format: 'number' }),
			...(typeof value === 'boolean' && { __format: 'boolean' }),
		};
	});
}

const mapped = mapEnvConfig(df);

module.exports = mapped;
