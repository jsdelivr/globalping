import * as process from 'node:process';
import _ from 'lodash';
import type {Socket} from 'socket.io';
import isIpPrivate from 'private-ip';
import requestIp from 'request-ip';
import {geoIpLookup} from '../lib/geoip/client.js';
import {
	getRegionByCountry,
	getStateNameByIso,
	getCountryByIso,
	getCountryIso3ByIso2,
	getCountryAliases,
	getNetworkAliases,
} from '../lib/location/location.js';
import {InternalError} from '../lib/internal-error.js';
import type {Probe, ProbeLocation} from './types.js';

/* eslint-disable @typescript-eslint/naming-convention */
const VERSION_REG_EXP = /^(?:\d{1,2}\.){2}\d{1,2}$/;
/* eslint-enable @typescript-eslint/naming-convention */

const fakeIpForDebug = () => _.sample([
	'95.155.94.127',
	'65.49.22.66',
	'185.229.226.83',
	'51.158.22.211',
	'131.255.7.26',
	'213.136.174.80',
	'94.214.253.78',
	'79.205.97.254',
])!;

const findProbeVersion = (socket: Socket) => String(socket.handshake.query['version']);

export const buildProbe = async (socket: Socket): Promise<Probe> => {
	const version = findProbeVersion(socket);

	if (!VERSION_REG_EXP.test(version)) {
		throw new InternalError(`invalid probe version (${version})`, true);
	}

	const clientIp = requestIp.getClientIp(socket.request);

	if (!clientIp) {
		throw new Error('failed to detect ip address of connected probe');
	}

	let ipInfo;

	// Todo: cache results for ip address
	if (process.env['FAKE_PROBE_IP']) {
		ipInfo = await geoIpLookup(fakeIpForDebug());
	} else if (!isIpPrivate(clientIp)) {
		ipInfo = await geoIpLookup(clientIp);
	}

	if (!ipInfo) {
		throw new Error(`couldn't detect probe location for ip ${clientIp}`);
	}

	const location: ProbeLocation = {
		continent: ipInfo.continent,
		region: getRegionByCountry(ipInfo.country),
		country: ipInfo.country,
		state: ipInfo.state,
		city: ipInfo.city,
		asn: ipInfo.asn,
		latitude: ipInfo.latitude,
		longitude: ipInfo.longitude,
		network: ipInfo.network,
	};

	const index = [
		...Object.entries(location)
			.filter(([key, value]) => value && !['asn', 'latitude', 'longitude'].includes(key))
			.map(entries => String(entries[1])),
		`as${location.asn}`,
		...(location.state ? [getStateNameByIso(location.state)] : []),
		getCountryByIso(location.country),
		getCountryIso3ByIso2(location.country),
		getCountryAliases(location.country),
		getNetworkAliases(location.network),
	].flat().map(s => s.toLowerCase().replace('-', ' '));

	// Todo: add validation and handle missing or partial data
	return {
		client: socket.id,
		version,
		ipAddress: clientIp,
		location,
		index,
	};
};
