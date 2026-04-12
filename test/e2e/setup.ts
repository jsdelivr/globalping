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
import { setResetAfterFailure } from './failure-reset.js';
import { scopedLogger } from '../../src/lib/logger.js';

const logger = scopedLogger('e2e-setup');
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

afterEach(async function () {
	const state = this.currentTest?.state;

	if (state === 'passed' || state === 'pending') {
		return;
	}

	logger.warn(`Test "${this.currentTest?.title ?? '<unknown>'}" failed and is retrying. Restarting probe and Redis.`);

	await flushRedis();
	await resetDbs(dbClients);

	await docker.stopProbeContainer();
	await docker.startProbeContainer();
	await waitProbeToConnect();
	setResetAfterFailure();
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
