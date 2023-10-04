import config from 'config';
import knex, { Knex } from 'knex';

export const client: Knex = knex({
	client: 'mysql',
	connection: config.get<string>('sql.url'),
});
