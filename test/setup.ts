import chai from 'chai';
import nock from 'nock';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { populateMemList } from '../src/lib/geoip/whitelist.js';
import {
	populateIpList,
	populateDomainList,
	populateIpRangeList,
	populateNockCitiesList,
} from './utils/populate-static-files.js';

import chaiOas from './plugins/oas/index.js';
import { getRedisClient, initRedis } from '../src/lib/redis/client.js';
import { client } from '../src/lib/sql/client.js';
import { USERS_TABLE } from '../src/lib/adopted-probes.js';

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));
	await initRedis();
	const redis = getRedisClient();
	await redis.flushDb();
	await client(USERS_TABLE).insert({ id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959', github: 'jimaek' }).onConflict().ignore();

	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');
	await populateIpList();
	await populateDomainList();
	await populateIpRangeList();
	await populateMemList();
	await populateNockCitiesList();
});
