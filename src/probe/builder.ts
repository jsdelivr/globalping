import * as process from 'node:process';
import _ from 'lodash';
import type {Socket} from 'socket.io';
import isIpPrivate from 'private-ip';
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
	let ipInfo;

	// Todo: remoteAddress is not reliable source when behind proxy
	// todo: cache results for ip address
	if (process.env['FAKE_PROBE_IP']) {
		ipInfo = await geoIpLookup(fakeIpForDebug());
	} else if (!isIpPrivate(socket.conn.remoteAddress)) {
		ipInfo = await geoIpLookup(socket.conn.remoteAddress);
	}

	if (
		!ipInfo
		|| !ipInfo?.city?.geonameId
		|| !ipInfo.country?.isoCode
		|| !ipInfo.continent?.code
		|| !ipInfo.traits?.autonomousSystemNumber
	) {
		throw new Error('couldn\'t detect probe location');
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
