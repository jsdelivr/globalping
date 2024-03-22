import config from 'config';
import Bluebird from 'bluebird';
import type { Knex } from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chai from 'chai';
import { createClient } from 'redis';

import { waitProbeToConnect } from './utils.js';
import chaiOas from './plugins/oas/index.js';
import { docker } from './docker.js';
import { client as sql } from './client.js';

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../../../public/v1/spec.yaml') }));

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
	const dbs = [ 0, 1, 2 ];
	dbs.forEach(async (database) => {
		const client = createClient({
			...config.util.toObject(config.get('redis')),
			database,
		});
		await client.flushDb();
	});
};
