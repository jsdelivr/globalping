import path from 'node:path';
import { fileURLToPath } from 'node:url';
import _ from 'lodash';
import config from 'config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbConfig = config.get('timeSeriesDb');

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
			acquireConnectionTimeout: 5000,
			seeds: {
				directory: path.join(__dirname, `./seeds/time-series-1/${environment}`),
			},
			migrations: {
				stub: './migrations/time-series-1/migration.stub',
				directory: path.join(__dirname, `./migrations/time-series-1`),
			},
		},
	};
}));
