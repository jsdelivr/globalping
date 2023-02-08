import * as process from 'node:process';
import _ from 'lodash';
import type {Socket} from 'socket.io/dist';
import isIpPrivate from 'private-ip';
import semver from 'semver';
import {
	getStateNameByIso,
	getCountryByIso,
	getCountryIso3ByIso2,
	getCountryAliases,
	getNetworkAliases,
} from '../lib/location/location.js';
import {InternalError} from '../lib/internal-error.js';
import {createGeoipClient} from '../lib/geoip/client.js';
import getProbeIp from '../lib/get-probe-ip.js';
import {getRegion} from '../lib/ip-ranges.js';
import type {Probe, ProbeLocation, Tag} from './types.js';

const fakeIpForDebug = () => _.sample([
	'18.200.0.1', // AWS eu-west-1
	'34.140.0.10', // GCP europe-west1
	'95.155.94.127',
	'65.49.22.66',
	'185.229.226.83',
	'51.158.22.211',
	'131.255.7.26',
	'213.136.174.80',
	'94.214.253.78',
	'79.205.97.254',
])!;

const geoipClient = createGeoipClient();

const findProbeVersion = (socket: Socket) => String(socket.handshake.query['version']);

export const buildProbe = async (socket: Socket): Promise<Probe> => {
	const version = findProbeVersion(socket);

	const host = process.env['HOSTNAME'] ?? '';

	const clientIp = process.env['FAKE_PROBE_IP'] ? fakeIpForDebug() : getProbeIp(socket.request);

	if (!clientIp) {
		throw new Error('failed to detect ip address of connected probe');
	}

	if (!semver.satisfies(version, '>=0.9.0')) {
		throw new InternalError(`invalid probe version (${version})`, true);
	}

	let ipInfo;

	if (!isIpPrivate(clientIp)) {
		ipInfo = await geoipClient.lookup(clientIp);
	}

	if (!ipInfo) {
		throw new Error(`couldn't detect probe location for ip ${clientIp}`);
	}

	const location = getLocation(ipInfo);

	const tags = getTags(clientIp);

	const index = [
		location.country,
		getCountryIso3ByIso2(location.country),
		getCountryByIso(location.country),
		getCountryAliases(location.country),
		location.normalizedCity,
		location.state ?? [],
		...(location.state ? [getStateNameByIso(location.state)] : []),
		location.continent,
		location.normalizedRegion,
		`as${location.asn}`,
		tags.filter(tag => tag.type === 'system').map(tag => tag.value),
		location.normalizedNetwork,
		getNetworkAliases(location.normalizedNetwork),
	].flat().filter(Boolean).map(s => s.toLowerCase().replaceAll('-', ' '));

	// Todo: add validation and handle missing or partial data
	return {
		client: socket.id,
		version,
		ipAddress: clientIp,
		host,
		location,
		index,
		resolvers: [],
		tags,
		stats: {
			cpu: {
				count: 0,
				load: [],
			},
			jobs: {count: 0},
		},
		ready: true,
	};
};

const getLocation = (ipInfo: ProbeLocation): ProbeLocation => ({
	continent: ipInfo.continent,
	region: ipInfo.region,
	normalizedRegion: ipInfo.normalizedRegion,
	country: ipInfo.country,
	state: ipInfo.state,
	city: ipInfo.city,
	normalizedCity: ipInfo.normalizedCity,
	asn: ipInfo.asn,
	latitude: ipInfo.latitude,
	longitude: ipInfo.longitude,
	network: ipInfo.network,
	normalizedNetwork: ipInfo.normalizedNetwork,
});

const getTags = (clientIp: string) => {
	const tags: Tag[] = [];
	const cloudRegion = getRegion(clientIp);
	if (cloudRegion) {
		tags.push({
			type: 'system',
			value: cloudRegion,
		});
	}

	return tags;
};
