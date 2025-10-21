import Bluebird from 'bluebird';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chai from 'chai';

import { waitProbeToConnect } from './utils.js';
import chaiOas from '../plugins/oas/index.js';
import { docker } from './docker.js';
import { dashboardClient, measurementStoreClient } from '../../src/lib/sql/client.js';
import { initRedisClient } from '../../src/lib/redis/client.js';
import { initPersistentRedisClient } from '../../src/lib/redis/persistent-client.js';
import { initMeasurementRedisClient } from '../../src/lib/redis/measurement-client.js';
import { resetDbs } from '../utils/db.js';

const dbClients = [ dashboardClient, measurementStoreClient ];

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../../public/v1/spec.yaml') }));

	await docker.removeProbeContainer();
	await docker.removeApiContainer();

	await flushRedis();
	await resetDbs(dbClients);

	await docker.createApiContainer();
	await docker.createProbeContainer();

	await waitProbeToConnect();
});

after(async () => {
	await docker.removeProbeContainer();
	await docker.removeApiContainer();
});

const flushRedis = async () => {
	const [ client1, client2, cluster1 ] = await Promise.all([
		initRedisClient(),
		initPersistentRedisClient(),
		initMeasurementRedisClient(),
	]);

	await Bluebird.all([
		client1.flushDb(),
		client2.flushDb(),
		cluster1.mapMasters(client => client.flushDb()),
	]);
};
