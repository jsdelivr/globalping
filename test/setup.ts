import {writeFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import nock from 'nock';
import {updateIpRangeFiles, sources} from '../src/lib/ip-ranges.js';

const resetIpRangeFiles = async () => {
	const mockDataPath = path.join(path.resolve(), 'test/mocks/ip-ranges');
	const gcpMockRanges = await readFile(path.join(mockDataPath, 'nock-gcp.json'), 'utf8');
	const awsMockRanges = await readFile(path.join(mockDataPath, 'nock-aws.json'), 'utf8');

	const gcpUrl = new URL(sources.gcp.url);
	const awsUrl = new URL(sources.aws.url);
	nock(gcpUrl.origin).get(gcpUrl.pathname).reply(200, gcpMockRanges);
	nock(awsUrl.origin).get(awsUrl.pathname).reply(200, awsMockRanges);
	await updateIpRangeFiles();
};

before(async () => {
	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');
	await resetIpRangeFiles();
});
