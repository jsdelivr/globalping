import _ from 'lodash';
import type {Socket} from 'socket.io';
import {geoIpLookup} from '../lib/geoip/client.js';
import type {Probe} from './store.js';

export const buildProbe = async (socket: Socket): Promise<Probe> => {
	// Todo: remoteAddress is not reliable source when behind proxy
	// todo: cache results for ip address
	// const ipInfo = await geoIpLookup(socket.conn.remoteAddress);
	const ipInfo = await geoIpLookup(_.sample([
		'95.155.94.127',
		'65.49.22.66',
		'185.229.226.83',
		'51.158.22.211',
		'131.255.7.26',
	])!);

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
		city: ipInfo.city.geonameId,
		country: ipInfo.country.isoCode,
		region: 'central-europe',
		continent: ipInfo.continent.code,
		asn: ipInfo.traits.autonomousSystemNumber,
	};
};
