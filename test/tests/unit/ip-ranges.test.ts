import {writeFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import nock from 'nock';
import {expect} from 'chai';
import {updateIpRangeFiles, sources, populateMemList, getRegion} from '../../../src/lib/ip-ranges.js';

const mockDataPath = path.join(path.resolve(), 'test/mocks/ip-ranges');
const gcpMockRanges = await readFile(path.join(mockDataPath, 'nock-gcp.json'), 'utf8');
const awsMockRanges = await readFile(path.join(mockDataPath, 'nock-aws.json'), 'utf8');

const gcpUrl = new URL('https://www.gstatic.com/ipranges/cloud.json');
const awsUrl = new URL('https://ip-ranges.amazonaws.com/ip-ranges.json');
nock(gcpUrl.origin).get(gcpUrl.pathname).reply(200, gcpMockRanges);
nock(awsUrl.origin).get(awsUrl.pathname).reply(200, awsMockRanges);

describe('cloud ip ranges', () => {
	describe('updateList', () => {
		const gcpFilePath = path.join(path.resolve(), sources.gcp.file);

		it('should override blacklist file', async () => {
			// Reset the file
			await writeFile(gcpFilePath, '', {encoding: 'utf8'});

			const preFile = await readFile(gcpFilePath, 'utf8').catch(() => null);
			await updateIpRangeFiles();
			const postFile = await readFile(gcpFilePath, 'utf8');

			expect(preFile).to.not.equal(postFile);
		});
	});

	describe('validate', () => {
		before(async () => {
			await populateMemList();
		});

		it('should return null', () => {
			const region = getRegion('100.0.41.228');
			expect(region).to.equal(null);
		});

		it('should return gcp region', () => {
			const region = getRegion('34.104.116.1');
			expect(region).to.equal('gcp-europe-central2');
		});

		it('should return aws region', () => {
			const region = getRegion('3.2.34.1');
			expect(region).to.equal('aws-af-south-1');
		});

		it('should return region for IPv6 ips', () => {
			const region = getRegion('2600:1900:4180::0001');
			expect(region).to.equal('gcp-us-west4');
		});
	});
});
