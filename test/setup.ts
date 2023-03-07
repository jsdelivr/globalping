import nock from 'nock';
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
});
