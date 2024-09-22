import './types.js';

import config from 'config';
import Bluebird from 'bluebird';
import * as chai from 'chai';
import nock from 'nock';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Knex } from 'knex';
import * as sinon from 'sinon';

const clock = sinon.createSandbox().useFakeTimers({
	now: Date.now(),
	shouldAdvanceTime: true,
	toFake: [ 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'hrtime', 'performance' ],
});

import { populateMemList } from '../src/lib/geoip/whitelist.js';
import {
	populateIpList,
	populateDomainList,
	populateIpRangeList,
	populateNockCitiesList,
} from './utils/populate-static-files.js';
import chaiOas from './plugins/oas/index.js';
import { initRedisClient } from '../src/lib/redis/client.js';
import { initPersistentRedisClient } from '../src/lib/redis/persistent-client.js';
import { initMeasurementRedisClient } from '../src/lib/redis/measurement-client.js';
import { initSubscriptionRedisClient } from '../src/lib/redis/subscription-client.js';
import { client as sql } from '../src/lib/sql/client.js';
import { extendSinonClock } from './utils/clock.js';

global.clock = extendSinonClock(clock);

const dbConfig = config.get<{ connection: { database: string, host: string } }>('db');

if (!dbConfig.connection.database.endsWith('-test') && dbConfig.connection.host !== 'localhost') {
	throw new Error(`Database name for test env needs to end with "-test" or the host must be "localhost". Got "${dbConfig.connection.database}"@"${dbConfig.connection.host}".`);
}

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	const redisClient = await initRedisClient();
	await redisClient.flushDb();
	const persistentRedisClient = await initPersistentRedisClient();
	await persistentRedisClient.flushDb();
	const measurementRedisClient = await initMeasurementRedisClient();
	await measurementRedisClient.flushDb();
	const subscriptionRedisClient = await initSubscriptionRedisClient();
	await subscriptionRedisClient.flushDb();

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

	// Brute force attempt at deleting all data regardless of foreign key constraints.
	for (let i = 0; i < allTables.length; i++) {
		await Bluebird.allSettled(allTables.map(table => sql.schema.raw(`delete from \`${table}\``)));
		await Bluebird.allSettled(allTables.map(table => sql.schema.raw(`drop table if exists \`${table}\``)));
	}

	await Bluebird.map(allTables, table => sql.schema.raw(`drop table if exists \`${table}\``));
};
