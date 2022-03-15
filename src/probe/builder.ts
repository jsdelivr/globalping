import * as process from 'node:process';
import _ from 'lodash';
import type {Socket} from 'socket.io';
import isIpPrivate from 'private-ip';
import requestIp from 'request-ip';
import {geoIpLookup} from '../lib/geoip/client.js';

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

export const buildProbe = async (socket: Socket): Promise<Probe> => {
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

	if (
		!ipInfo
		|| !ipInfo?.city?.geonameId
		|| !ipInfo.country?.isoCode
		|| !ipInfo.continent?.code
		|| !ipInfo.traits?.autonomousSystemNumber
	) {
		throw new Error(`couldn't detect probe location for ip ${clientIp}`);
	}

	// Todo: add validation and handle missing or partial data
	return {
		client: socket.id,
		ipAddress: socket.conn.remoteAddress,
		location: {
			city: ipInfo.city.geonameId,
			country: ipInfo.country.isoCode,
			region: 'central-europe',
			continent: ipInfo.continent.code,
			asn: ipInfo.traits.autonomousSystemNumber,
		},
	};
};
