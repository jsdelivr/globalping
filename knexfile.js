import _ from 'lodash';
import config from 'config';

const dbConfig = config.get('db');

/**
 * @typedef {import('knex').Knex.Config} KnexConfig
 * @type {{ [key: string]: KnexConfig }}
 */
export default _.merge({}, ...[ 'development', 'production', 'staging', 'test' ].map((environment) => {
	return {
		[environment]: {
			client: dbConfig.type,
			connection: dbConfig.connection,
			pool: {
				min: 0,
				max: 10,
				propagateCreateError: false,
			},
			acquireConnectionTimeout: 10000,
		},
	};
}));
