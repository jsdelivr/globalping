import config from 'config';
import newrelic from 'newrelic';
import {type City, WebServiceClient} from '@maxmind/geoip2-node';
import type {WebServiceClientError} from '@maxmind/geoip2-node/dist/src/types';
import type {LocationInfo} from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
	normalizeNetworkName,
} from '../utils.js';

const client = new WebServiceClient(config.get('maxmind.accountId'), config.get('maxmind.licenseKey'));

export const isMaxmindError = (error: unknown): error is WebServiceClientError => (error as WebServiceClientError).code !== undefined;

const query = async (addr: string, retryCounter = 0): Promise<City> => {
	try {
		return await client.city(addr);
	} catch (error: unknown) {
		if (isMaxmindError(error)) {
			if (error.code === 'SERVER_ERROR' && retryCounter < 3) {
				return query(addr, retryCounter + 1);
			}

			if (error.code === 'ACCOUNT_ID_REQUIRED') {
				newrelic.noticeError(new Error(error.error), {client: 'maxmind'});
			}
		}

		throw new Error('no maxmind data');
	}
};

export const maxmindLookup = async (addr: string): Promise<LocationInfo> => {
	const data = await query(addr);

	return {
		continent: data.continent?.code ?? '',
		country: data.country?.isoCode ?? '',
		state: data.country?.isoCode === 'US' ? data.subdivisions?.map(s => s.isoCode)[0] ?? '' : undefined,
		city: normalizeCityNamePublic(data.city?.names?.en ?? ''),
		normalizedCity: normalizeCityName(data.city?.names?.en ?? ''),
		asn: data.traits?.autonomousSystemNumber ?? 0,
		latitude: data.location?.latitude ?? 0,
		longitude: data.location?.longitude ?? 0,
		network: data.traits?.isp ?? '',
		normalizedNetwork: normalizeNetworkName(data.traits?.isp ?? ''),
	};
};
