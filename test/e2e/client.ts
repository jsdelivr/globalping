import knex, { Knex } from 'knex';
import config from 'config';

const dbConfig = config.util.toObject(config.get('db'));

const environment = process.env['NODE_ENV'] || 'development';

export const client: Knex = knex({
	client: dbConfig.type,
	connection: dbConfig.connection,
	pool: {
		min: 0,
		max: 10,
		propagateCreateError: false,
	},
	acquireConnectionTimeout: 10000,
	seeds: {
		directory: `./seeds/${environment}`,
	},
});
