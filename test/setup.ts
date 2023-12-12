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
import { getRedisClient, initRedis } from '../src/lib/redis/client.js';
import { client as sql } from '../src/lib/sql/client.js';

if (process.env['NODE_ENV'] !== 'test') {
	throw new Error(`NODE_ENV is not 'test' but '${process.env['NODE_ENV']}'.`);
}

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	await initRedis();
	const redis = getRedisClient();
	await redis.flushDb();

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
