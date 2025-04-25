import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nock from 'nock';
import AdmZip from 'adm-zip';
import {
	sourceList as ipSourceList,
	populateMemList as populateMemIpList,
	updateList as updateListIp,
} from '../../src/lib/malware/ip.js';
import {
	sourceList as domainSourceList,
	populateMemList as populateMemDomainList,
	updateList as updateListDomain,
} from '../../src/lib/malware/domain.js';
import {
	updateIpRangeFiles,
	sources as cloudIpRangesSources,
	populateMemList as populateMemCloudIpRangesList,
} from '../../src/lib/cloud-ip-ranges.js';
import {
	updateBlockedIpRangesFiles,
	sources as blockedIpRangesSources,
	populateMemList as populateMemBlockedIpRangesList,
} from '../../src/lib/blocked-ip-ranges.js';
import { populateCitiesList, updateGeonamesCitiesFile, URL as citiesListUrl } from '../../src/lib/geoip/city-approximation.js';

const mockDataPath = path.join(path.resolve(), 'test/mocks');

const ipMockResult = await readFile(path.join(mockDataPath, 'malware/nock-ip.txt'), 'utf8');
const domainMockResult = await readFile(path.join(mockDataPath, 'malware/nock-domain.txt'), 'utf8');
const gcpMockRanges = await readFile(path.join(mockDataPath, 'cloud-ip-ranges/nock-gcp.json'), 'utf8');
const awsMockRanges = await readFile(path.join(mockDataPath, 'cloud-ip-ranges/nock-aws.json'), 'utf8');
const appleRelayMockRanges = await readFile(path.join(mockDataPath, 'blocked-ip-ranges/nock-apple-relay.csv'), 'utf8');

export const populateIpList = async (): Promise<void> => {
	for (const source of ipSourceList) {
		const url = new URL(source);

		nock(url.origin)
			.get(url.pathname)
			.reply(200, ipMockResult);
	}

	await updateListIp();
	await populateMemIpList();
};

export const populateDomainList = async (): Promise<void> => {
	for (const source of domainSourceList) {
		const url = new URL(source);

		nock(url.origin)
			.get(url.pathname)
			.reply(200, domainMockResult);
	}

	await updateListDomain();
	await populateMemDomainList();
};

export const populateCloudIpRangesList = async (): Promise<void> => {
	const gcpUrl = new URL(cloudIpRangesSources.gcp.url);
	const awsUrl = new URL(cloudIpRangesSources.aws.url);
	nock(gcpUrl.origin).get(gcpUrl.pathname).reply(200, gcpMockRanges);
	nock(awsUrl.origin).get(awsUrl.pathname).reply(200, awsMockRanges);
	await updateIpRangeFiles();
	await populateMemCloudIpRangesList();
};

export const populateBlockedIpRangesList = async (): Promise<void> => {
	const appleRelayUrl = new URL(blockedIpRangesSources.appleRelay.url);
	nock(appleRelayUrl.origin).get(appleRelayUrl.pathname).reply(200, appleRelayMockRanges);
	await updateBlockedIpRangesFiles();
	await populateMemBlockedIpRangesList();
};

export const populateNockCitiesList = async (): Promise<void> => {
	const zip = new AdmZip();
	zip.addLocalFile(path.join(mockDataPath, 'cities15000.txt'));
	const url = new URL(citiesListUrl);
	nock(url.origin).get(url.pathname).reply(200, zip.toBuffer());
	await updateGeonamesCitiesFile();
	await populateCitiesList();
};
