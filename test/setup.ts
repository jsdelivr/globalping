import chai from 'chai';
import nock from 'nock';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { populateMemList } from '../src/lib/geoip/whitelist.js';
import {
	populateIpList,
	populateDomainList,
	populateIpRangeList,
} from './utils/populate-static-files.js';

import chaiOas from './plugins/oas/index.js';

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');
	await populateIpList();
	await populateDomainList();
	await populateIpRangeList();
	await populateMemList();
});
