import * as process from 'node:process';
import type { Socket } from 'socket.io';
import { isIpPrivate } from '../lib/private-ip.js';
import semver from 'semver';
import {
	getStateNameByIso,
	getCountryByIso,
	getCountryIso3ByIso2,
	getCountryAliases,
	getNetworkAliases,
	getContinentAliases,
	getRegionAliases,
} from '../lib/location/location.js';
import { ProbeError } from '../lib/probe-error.js';
import { createGeoipClient } from '../lib/geoip/client.js';
import getProbeIp from '../lib/get-probe-ip.js';
import { getRegion } from '../lib/ip-ranges.js';
import type { Probe, ProbeLocation, Tag } from './types.js';
import { verifyIpLimit } from '../lib/ws/helper/probe-ip-limit.js';
import { fakeLookup } from '../lib/geoip/fake-client.js';

const geoipClient = createGeoipClient();

export const buildProbe = async (socket: Socket): Promise<Probe> => {
	const version = String(socket.handshake.query['version']);

	const nodeVersion = String(socket.handshake.query['nodeVersion']);

	const uuid = String(socket.handshake.query['uuid']);

	const host = process.env['HOSTNAME'] ?? '';

	const ip = getProbeIp(socket);

	if (!ip) {
		throw new Error('failed to detect ip address of connected probe');
	}

	if (!semver.satisfies(version, '>=0.9.0')) {
		throw new ProbeError(`invalid probe version (${version})`);
	}

	let ipInfo;

	if (process.env['FAKE_PROBE_IP'] === 'probe') {
		ipInfo = fakeLookup();
	} else if (!isIpPrivate(ip)) {
		ipInfo = await geoipClient.lookup(ip);
	}

	if (!ipInfo) {
		throw new Error(`couldn't detect probe location for ip ${ip}`);
	}

	await verifyIpLimit(ip, socket.id);

	const location = getLocation(ipInfo);

	const tags = getTags(ip);

	// Storing index as string[][] so every category will have it's exact position in the index array across all probes
	const index = [
		[ location.country ],
		[ getCountryIso3ByIso2(location.country) ],
		[ getCountryByIso(location.country) ],
		getCountryAliases(location.country),
		[ location.normalizedCity ],
		location.state ? [ location.state ] : [],
		location.state ? [ getStateNameByIso(location.state) ] : [],
		[ location.continent ],
		getContinentAliases(location.continent),
		[ location.normalizedRegion ],
		getRegionAliases(location.normalizedRegion),
		[ `as${location.asn}` ],
		tags.filter(tag => tag.type === 'system').map(tag => tag.value),
		[ location.normalizedNetwork ],
		getNetworkAliases(location.normalizedNetwork),
	].map(category => category.map(s => s.toLowerCase().replaceAll('-', ' ')));

	// Todo: add validation and handle missing or partial data
	return {
		client: socket.id,
		version,
		nodeVersion,
		uuid,
		ipAddress: ip,
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
			jobs: { count: 0 },
		},
		status: 'initializing',
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
