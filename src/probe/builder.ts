import * as process from 'node:process';
import type { Socket } from 'socket.io';
import { isIpPrivate } from '../lib/private-ip.js';
import semver from 'semver';
import _ from 'lodash';
import { getIndex } from '../lib/location/location.js';
import { ProbeError } from '../lib/probe-error.js';
import { getGeoIpClient, LocationInfo } from '../lib/geoip/client.js';
import getProbeIp from '../lib/get-probe-ip.js';
import { getCloudTags } from '../lib/cloud-ip-ranges.js';
import type { ExtendedProbeLocation, SocketProbe, Tag } from './types.js';
import { probeIpLimit } from '../lib/ws/server.js';
import { fakeLookup } from '../lib/geoip/fake-client.js';
import { getGroupingKey, normalizeTags } from '../lib/geoip/utils.js';
import { isIpBlocked } from '../lib/blocked-ip-ranges.js';

export const buildProbe = async (socket: Socket): Promise<SocketProbe> => {
	const version = String(socket.handshake.query['version']);
	const nodeVersion = String(socket.handshake.query['nodeVersion']);
	const totalMemory = Number(socket.handshake.query['totalMemory']);
	const totalDiskSize = Number(socket.handshake.query['totalDiskSize']);
	const availableDiskSpace = Number(socket.handshake.query['availableDiskSpace']);
	const uuid = String(socket.handshake.query['uuid']);
	const isHardware = socket.handshake.query['isHardware'] === 'true' || socket.handshake.query['isHardware'] === '1';
	const hardwareDeviceValue = socket.handshake.query['hardwareDevice'];
	const hardwareDevice = !hardwareDeviceValue ? null : String(hardwareDeviceValue);
	const hardwareDeviceFirmwareValue = socket.handshake.query['hardwareDeviceFirmware'];
	const hardwareDeviceFirmware = !hardwareDeviceFirmwareValue ? null : String(hardwareDeviceFirmwareValue);
	const adoptionTokenValue = socket.handshake.query['adoptionToken'];
	const adoptionToken = !adoptionTokenValue ? null : String(adoptionTokenValue);
	const host = process.env['HOSTNAME'] ?? '';

	const ip = getProbeIp(socket);

	if (!ip) {
		throw new Error('failed to detect ip address of connected probe');
	}

	if (isIpBlocked(ip)) {
		throw new ProbeError(`vpn detected: ${ip}`);
	}

	if (!semver.satisfies(version, '>=0.39.0')) {
		throw new ProbeError(`invalid probe version (${version})`);
	}

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

	await probeIpLimit.verifyIpLimit(ip, socket.id);

	const location = getLocation(ipInfo);

	const tags = getTags(ip, ipInfo);
	const normalizedTags = normalizeTags(tags);

	const index = getIndex(location, normalizedTags);

	// Todo: add validation and handle missing or partial data
	return {
		client: socket.id,
		version,
		nodeVersion,
		uuid,
		isHardware,
		hardwareDevice,
		hardwareDeviceFirmware,
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
			totalMemory,
			totalDiskSize,
			availableDiskSpace,
		},
		status: 'initializing',
		isIPv4Supported: false,
		isIPv6Supported: false,
		adoptionToken,
	};
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
