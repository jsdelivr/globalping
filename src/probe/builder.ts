import * as process from 'node:process';
import type { Socket } from 'socket.io';
import { isIpPrivate } from '../lib/private-ip.js';
import _ from 'lodash';
import { getIndex } from '../lib/location/location.js';
import { ProbeError } from '../lib/probe-error.js';
import { getGeoIpClient, LocationInfo } from '../lib/geoip/client.js';
import getProbeIp from '../lib/get-probe-ip.js';
import { getCloudTags } from '../lib/cloud-ip-ranges.js';
import type { ExtendedProbeLocation, SocketProbe, Tag } from './types.js';
import type { ProbeIpLimit } from '../lib/ws/helper/probe-ip-limit.js';
import { fakeLookup } from '../lib/geoip/fake-client.js';
import { getGroupingKey, normalizeTags } from '../lib/geoip/utils.js';
import { isIpBlocked } from '../lib/blocked-ip-ranges.js';
import { parseHandshakeQuery } from './schema/handshake-schema.js';

export const buildProbe = async (socket: Socket, probeIpLimit: ProbeIpLimit): Promise<SocketProbe> => {
	const handshake = parseHandshakeQuery(socket.handshake.query);
	const host = process.env['HOSTNAME'] ?? '';

	const ip = getProbeIp(socket);

	if (!ip) {
		throw new Error('failed to detect ip address of connected probe');
	}

	if (isIpBlocked(ip)) {
		throw new ProbeError(`vpn detected: ${ip}`);
	}

	await probeIpLimit.verifyIpLimit(ip, socket.id);

	let ipInfo;

	if (process.env['TEST_MODE'] === 'perf' || process.env['TEST_MODE'] === 'e2e') {
		ipInfo = fakeLookup();
	} else if (!isIpPrivate(ip)) {
		const geoIpClient = getGeoIpClient();
		ipInfo = await geoIpClient.lookup(ip);
	}

	if (!ipInfo) {
		throw new Error(`couldn't detect probe location for ip ${ip}`);
	}

	const location = getLocation(ipInfo);

	const tags = getTags(ip, ipInfo);
	const normalizedTags = normalizeTags(tags);

	const index = getIndex(location, normalizedTags);

	const probe: SocketProbe = {
		client: socket.id,
		version: handshake.version,
		nodeVersion: handshake.nodeVersion,
		uuid: handshake.uuid,
		isHardware: handshake.isHardware,
		hardwareDevice: handshake.hardwareDevice,
		hardwareDeviceFirmware: handshake.hardwareDeviceFirmware,
		ipAddress: ip,
		altIpAddresses: [],
		host,
		location,
		index,
		resolvers: [],
		tags,
		normalizedTags,
		stats: {
			cpu: {
				load: [],
			},
			jobs: { count: 0 },
		},
		hostInfo: {
			totalMemory: handshake.totalMemory,
			totalDiskSize: handshake.totalDiskSize,
			availableDiskSpace: handshake.availableDiskSpace,
		},
		status: 'initializing',
		isIPv4Supported: false,
		isIPv6Supported: false,
		adoptionToken: handshake.adoptionToken,
		isProxy: ipInfo.isProxy,
	};

	await probeIpLimit.verifyAsnLimit(probe);

	return probe;
};

export const updateProbeAltIps = (probe: SocketProbe, altIps: string[]): void => {
	probe.altIpAddresses = altIps.toSorted((a, b) => a.localeCompare(b));
	const newTags = probe.tags.filter(tag => tag.subtype !== 'cloud');

	for (const ip of [ probe.ipAddress, ...altIps ]) {
		const cloudTags = getCloudTags(ip);

		if (cloudTags.length) {
			newTags.unshift(...cloudTags.map(value => ({ type: 'system', subtype: 'cloud', value } as const)));
			break;
		}
	}

	if (!_.isEqual(newTags, probe.tags)) {
		probe.tags = newTags;
		probe.normalizedTags = normalizeTags(probe.tags);
		probe.index = getIndex(probe.location, probe.normalizedTags);
	}
};

const getLocation = (ipInfo: LocationInfo): ExtendedProbeLocation => ({
	continent: ipInfo.continent,
	region: ipInfo.region,
	country: ipInfo.country,
	state: ipInfo.state,
	city: ipInfo.city,
	normalizedCity: ipInfo.normalizedCity,
	asn: ipInfo.asn,
	latitude: ipInfo.latitude,
	longitude: ipInfo.longitude,
	network: ipInfo.network,
	normalizedNetwork: ipInfo.normalizedNetwork,
	allowedCountries: ipInfo.allowedCountries,
	groupingKey: getGroupingKey(ipInfo.country, ipInfo.state, ipInfo.normalizedCity, ipInfo.asn),
});

const getTags = (clientIp: string, ipInfo: LocationInfo) => {
	const tags: Tag[] = [];
	const cloudTags = getCloudTags(clientIp);

	tags.push(...cloudTags.map(value => ({ type: 'system', subtype: 'cloud', value } as const)));

	if (ipInfo.isHosting === true) {
		tags.push({
			type: 'system',
			value: 'datacenter-network',
		});
	} else if (ipInfo.isHosting === false) {
		tags.push({
			type: 'system',
			value: 'eyeball-network',
		});
	}

	return tags;
};
