import path from 'node:path';
import { fileURLToPath } from 'node:url';
import knex, { Knex } from 'knex';
import config from 'config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
		directory: path.join(__dirname, `../../seeds/${environment}`),
	},
	migrations: {
		directory: path.join(__dirname, `../../migrations`),
	},
});
