import config from 'config';
import Bluebird from 'bluebird';
import chai from 'chai';
import nock from 'nock';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Knex } from 'knex';

import { populateMemList } from '../src/lib/geoip/whitelist.js';
import {
	populateIpList,
	populateDomainList,
	populateIpRangeList,
	populateNockCitiesList,
} from './utils/populate-static-files.js';
import chaiOas from './plugins/oas/index.js';
import { initRedisClient } from '../src/lib/redis/client.js';
import { getPersistentRedisClient, initPersistentRedisClient } from '../src/lib/redis/persistent-client.js';
import { client as sql } from '../src/lib/sql/client.js';

const dbConfig = config.get<{ connection: { database: string, host: string } }>('db');

if (!dbConfig.connection.database.endsWith('-test') && dbConfig.connection.host !== 'localhost') {
	throw new Error(`Database name for test env needs to end with "-test" or the host must be "localhost". Got "${dbConfig.connection.database}"@"${dbConfig.connection.host}".`);
}

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	await initRedisClient();
	await initPersistentRedisClient();
	const persistentRedisClient = getPersistentRedisClient();
	await persistentRedisClient.flushDb();

	await dropAllTables(sql);
	await sql.migrate.latest();
	await sql.seed.run();

	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');

	await populateIpList();
	await populateDomainList();
	await populateIpRangeList();
	await populateMemList();
	await populateNockCitiesList();
});

const dropAllTables = async (sql: Knex) => {
	const allTables = (await sql('information_schema.tables')
		.whereRaw(`table_schema = database()`)
		.select(`table_name as table`)
	).map(({ table }: { table: string }) => table);
	await Bluebird.map(allTables, table => sql.schema.raw(`drop table \`${table}\``));
};
