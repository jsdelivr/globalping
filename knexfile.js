import path from 'node:path';
import { fileURLToPath } from 'node:url';
import _ from 'lodash';
import config from 'config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
			seeds: {
				directory: path.join(__dirname, `./seeds/${environment}`),
			},
			migrations: {
				directory: path.join(__dirname, `./migrations`),
			},
		},
	};
}));
