import './types.js';

import * as chai from 'chai';
import nock from 'nock';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
	populateCloudIpRangesList,
	populateNockCitiesList,
	populateBlockedIpRangesList,
} from './utils/populate-static-files.js';
import chaiOas from './plugins/oas/index.js';
import { initRedisClient } from '../src/lib/redis/client.js';
import { initPersistentRedisClient } from '../src/lib/redis/persistent-client.js';
import { initMeasurementRedisClient } from '../src/lib/redis/measurement-client.js';
import { initSubscriptionRedisClient } from '../src/lib/redis/subscription-client.js';
import { dashboardClient, measurementStoreClient } from '../src/lib/sql/client.js';
import { populateLegalNames } from '../src/lib/geoip/legal-name-normalization.js';
import { populateAsnData } from '../src/lib/geoip/asns.js';
import { extendSinonClock } from './utils/clock.js';
import { resetDbs } from './utils/db.js';

global.clock = extendSinonClock(clock);

const dbClients = [ dashboardClient, measurementStoreClient ];

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	const redisClient = await initRedisClient();
	await redisClient.flushDb();
	const persistentRedisClient = await initPersistentRedisClient();
	await persistentRedisClient.flushDb();
	const measurementRedisClient = await initMeasurementRedisClient();
	await measurementRedisClient.mapMasters<string>(client => client.flushDb());
	const subscriptionRedisClient = await initSubscriptionRedisClient();
	await subscriptionRedisClient.flushDb();
	await resetDbs(dbClients);

	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');

	await populateIpList();
	await populateDomainList();
	await populateCloudIpRangesList();
	await populateBlockedIpRangesList();
	await populateMemList();
	await populateNockCitiesList();
	await populateLegalNames();
	await populateAsnData();
});
