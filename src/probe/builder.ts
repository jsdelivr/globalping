import * as process from 'node:process';
import type { Socket } from 'socket.io';
import { isIpPrivate } from '../lib/private-ip.js';
import semver from 'semver';
import { getIndex } from '../lib/location/location.js';
import { ProbeError } from '../lib/probe-error.js';
import { getGeoIpClient, LocationInfo } from '../lib/geoip/client.js';
import getProbeIp from '../lib/get-probe-ip.js';
import { getRegion } from '../lib/ip-ranges.js';
import type { Probe, ProbeLocation, Tag } from './types.js';
import { probeIpLimit } from '../lib/ws/server.js';
import { fakeLookup } from '../lib/geoip/fake-client.js';


export const buildProbe = async (socket: Socket): Promise<Probe> => {
	const version = String(socket.handshake.query['version']);
	const nodeVersion = String(socket.handshake.query['nodeVersion']);
	const totalMemory = Number(socket.handshake.query['totalMemory']);
	const totalDiskSize = Number(socket.handshake.query['totalDiskSize']);
	const availableDiskSpace = Number(socket.handshake.query['availableDiskSpace']);
	const uuid = String(socket.handshake.query['uuid']);
	const isHardware = socket.handshake.query['isHardware'] === 'true' || socket.handshake.query['isHardware'] === '1';
	const hardwareDeviceValue = socket.handshake.query['hardwareDevice'];
	const hardwareDevice = (!hardwareDeviceValue || hardwareDeviceValue === 'undefined') ? null : String(hardwareDeviceValue);
	const host = process.env['HOSTNAME'] ?? '';

	const ip = getProbeIp(socket);

	if (!ip) {
		throw new Error('failed to detect ip address of connected probe');
	}

	if (!semver.satisfies(version, '>=0.9.0')) {
		throw new ProbeError(`invalid probe version (${version})`);
	}

	let ipInfo;

	if (process.env['TEST_MODE'] === 'perf') {
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

	const index = getIndex(location, tags);

	// Todo: add validation and handle missing or partial data
	return {
		client: socket.id,
		version,
		nodeVersion,
		uuid,
		isHardware,
		hardwareDevice,
		ipAddress: ip,
		altIpAddresses: [],
		host,
		location,
		index,
		resolvers: [],
		tags,
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
	};
};

const getLocation = (ipInfo: LocationInfo): ProbeLocation => ({
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
});

const getTags = (clientIp: string, ipInfo: LocationInfo) => {
	const tags: Tag[] = [];
	const cloudRegion = getRegion(clientIp);

	if (cloudRegion) {
		tags.push({
			type: 'system',
			value: cloudRegion,
		});
	}

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
