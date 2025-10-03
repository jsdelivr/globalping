import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import nock from 'nock';
import { expect } from 'chai';
import { updateIpRangeFiles, sources, populateMemList, getCloudTags } from '../../../src/lib/cloud-ip-ranges.js';

const mockDataPath = path.join(path.resolve(), 'test/mocks/cloud-ip-ranges');
const gcpMockRanges = await readFile(path.join(mockDataPath, 'nock-gcp.json'), 'utf8');
const awsMockRanges = await readFile(path.join(mockDataPath, 'nock-aws.json'), 'utf8');
const azureMockRanges = await readFile(path.join(mockDataPath, 'nock-azure.json'), 'utf8');
const ociMockRanges = await readFile(path.join(mockDataPath, 'nock-oci.json'), 'utf8');
const gcpUrl = new URL(sources.gcp.url);
const awsUrl = new URL(sources.aws.url);
const azureUrl = new URL(sources.azure.url);
const ociUrl = new URL(sources.oci.url);

describe('cloud ip ranges', () => {
	before(() => {
		nock(gcpUrl.origin).get(gcpUrl.pathname).reply(200, gcpMockRanges);
		nock(awsUrl.origin).get(awsUrl.pathname).reply(200, awsMockRanges);
		nock(azureUrl.origin).get(azureUrl.pathname).reply(200, azureMockRanges);
		nock(ociUrl.origin).get(ociUrl.pathname).reply(200, ociMockRanges);
	});

	after(() => {
		nock.cleanAll();
	});

	describe('updateList', () => {
		const gcpFilePath = path.join(path.resolve(), sources.gcp.file);

		it('should override blacklist file', async () => {
			// Reset the file
			await writeFile(gcpFilePath, '', { encoding: 'utf8' });

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

		it('should return []', () => {
			const cloudTags = getCloudTags('100.0.41.228');
			expect(cloudTags).to.deep.equal([]);
		});

		it('should return gcp cloudTags', () => {
			const cloudTags = getCloudTags('34.104.116.1');
			expect(cloudTags).to.deep.equal([ 'gcp-europe-central2', 'gcp' ]);
		});

		it('should return aws cloudTags', () => {
			const cloudTags = getCloudTags('3.2.34.1');
			expect(cloudTags).to.deep.equal([ 'aws-af-south-1', 'aws' ]);
		});

		it('should return azure cloudTags', () => {
			const cloudTags = getCloudTags('20.215.0.64');
			expect(cloudTags).to.deep.equal([ 'azure-polandcentral', 'azure' ]);
		});

		it('should return oci cloudTags', () => {
			const cloudTags = getCloudTags('129.80.0.0');
			expect(cloudTags).to.deep.equal([ 'oci-us-ashburn-1', 'oci' ]);
		});

		it('should return cloudTags for gcp IPv6 ips', () => {
			const cloudTags = getCloudTags('2600:1900:4180::0001');
			expect(cloudTags).to.deep.equal([ 'gcp-us-west4', 'gcp' ]);
		});

		it('should return cloudTags for aws IPv6 ips', () => {
			const cloudTags = getCloudTags('2600:1ff2:4000::0001');
			expect(cloudTags).to.deep.equal([ 'aws-us-west-2', 'aws' ]);
		});

		it('should return cloudTags for azure IPv6 ips', () => {
			const cloudTags = getCloudTags('2603:1020:1302::40');
			expect(cloudTags).to.deep.equal([ 'azure-polandcentral', 'azure' ]);
		});
	});
});
