const _ = require('lodash');
const df = require('./default.cjs');

function mapEnvConfig (object, prefix = '') {
	return _.mapValues(object, (value, key) => {
		if (_.isObject(value)) {
			return mapEnvConfig(value, (prefix ? `${prefix}_` : '') + _.snakeCase(key).toUpperCase());
		}

		return (prefix ? `${prefix}_` : '') + _.snakeCase(key).toUpperCase();
	});
}

const mapped = mapEnvConfig(df);

module.exports = mapped;
