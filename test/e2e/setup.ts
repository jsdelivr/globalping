import _ from 'lodash';
import config from 'config';
import Bluebird from 'bluebird';
import type { Knex } from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chai from 'chai';
import { createClient, type RedisClientOptions } from 'redis';

import { waitProbeToConnect } from './utils.js';
import chaiOas from '../plugins/oas/index.js';
import { docker } from './docker.js';
import { client as sql } from '../../src/lib/sql/client.js';

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../../public/v1/spec.yaml') }));

	await docker.removeProbeContainer();
	await docker.removeApiContainer();

	await flushRedis();

	await dropAllTables(sql);
	await sql.migrate.latest();
	await sql.seed.run();

	await docker.createApiContainer();
	await docker.createProbeContainer();

	await waitProbeToConnect();
});

after(async () => {
	await docker.removeProbeContainer();
	await docker.removeApiContainer();
});

const dropAllTables = async (sql: Knex) => {
	const allTables = (await sql('information_schema.tables')
		.whereRaw(`table_schema = database()`)
		.select(`table_name as table`)
	).map(({ table }: { table: string }) => table);
	await Bluebird.map(allTables, table => sql.schema.raw(`drop table \`${table}\``));
};

const flushRedis = async () => {
	const urls = [
		config.get<string>('redis.standalonePersistent.url'),
		config.get<string>('redis.standaloneNonPersistent.url'),
		config.get<string>('redis.clusterMeasurements.nodes.0'),
		config.get<string>('redis.clusterMeasurements.nodes.1'),
		config.get<string>('redis.clusterMeasurements.nodes.2'),
	];

	await Promise.all(urls.map(async (url) => {
		const client = createClient({
			url,
			..._.cloneDeep(config.get('redis.sharedOptions') as RedisClientOptions),
		});
		await client.connect();
		await client.flushDb();
	}));
};
