import path from 'node:path';
import Bluebird from 'bluebird';
import { fileURLToPath } from 'node:url';
import chai from 'chai';
import type { Knex } from 'knex';

import chaiOas from '../test/plugins/oas/index.js';
import { docker } from './docker.js';
import { waitProbeToConnect } from './utils.js';
import { client as sql } from '../src/lib/sql/client.js';
import { initRedisClient } from '../src/lib/redis/client.js';
import { initPersistentRedisClient } from '../src/lib/redis/persistent-client.js';
import { initMeasurementRedisClient } from '../src/lib/redis/measurement-client.js';

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	await Promise.all([ docker.removeApiContainer(), docker.removeProbeContainer() ]);

	const redisClient = await initRedisClient();
	await redisClient.flushDb();
	const persistentRedisClient = await initPersistentRedisClient();
	await persistentRedisClient.flushDb();
	const measurementRedisClient = await initMeasurementRedisClient();
	await measurementRedisClient.flushDb();


	await dropAllTables(sql);
	await sql.migrate.latest();
	await sql.seed.run();

	await Promise.all([ docker.createApiContainer(), docker.createProbeContainer() ]);
	await waitProbeToConnect();
});

after(async () => {
	await Promise.all([ docker.removeApiContainer(), docker.removeProbeContainer() ]);
});

const dropAllTables = async (sql: Knex) => {
	const allTables = (await sql('information_schema.tables')
		.whereRaw(`table_schema = database()`)
		.select(`table_name as table`)
	).map(({ table }: { table: string }) => table);
	await Bluebird.map(allTables, table => sql.schema.raw(`drop table \`${table}\``));
};
