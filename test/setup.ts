import nock from 'nock';
import { populateMemList } from '../src/lib/geoip/whitelist.js';
import {
	populateIpList,
	populateDomainList,
	populateIpRangeList,
} from './utils/populate-static-files.js';

before(async () => {
	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');
	await populateIpList();
	await populateDomainList();
	await populateIpRangeList();
	await populateMemList();
});
