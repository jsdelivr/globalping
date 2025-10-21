import type { Knex } from 'knex';
import Bluebird from 'bluebird';

export const dropAllTables = async (sql: Knex) => {
	const isMysql = sql.client.config.client === 'mysql';
	const quote = (table: string) => `${isMysql ? '`' : '"'}${table}${isMysql ? '`' : '"'}`;
	const schemaQuery = isMysql
		? sql('information_schema.tables').whereRaw('table_schema = database()')
		: sql('information_schema.tables').whereRaw('table_schema = \'public\'');

	const allTables = (await schemaQuery.select('table_name as table')).map(({ table }: { table: string }) => table);

	// Brute force attempt at deleting all data regardless of foreign key constraints.
	for (let i = 0; i < allTables.length; i++) {
		await Bluebird.allSettled(allTables.map(table => sql.schema.raw(`delete from ${quote(table)}`)));
		await Bluebird.allSettled(allTables.map(table => sql.schema.raw(`drop table if exists ${quote(table)}`)));
	}

	await Bluebird.map(allTables, table => sql.schema.raw(`drop table if exists ${quote(table)}`));
};

export const ensureTestConfig = (dbConfig: { connection: { database: string; host: string } }) => {
	if (!dbConfig.connection.database.endsWith('-test') && dbConfig.connection.host !== 'localhost') {
		throw new Error(`Database name for test env needs to end with "-test" or the host must be "localhost". Got "${dbConfig.connection.database}"@"${dbConfig.connection.host}".`);
	}
};

export const resetDb = async (dbClient: Knex) => {
	ensureTestConfig(dbClient.client.config);
	await dropAllTables(dbClient);
	await dbClient.migrate.latest();
	await dbClient.seed.run();
};

export const resetDbs = async (dbClients: Knex[]) => {
	await Promise.all(dbClients.map(dbClient => resetDb(dbClient)));
};
