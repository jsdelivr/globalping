import config from 'config';
import { type City, WebServiceClient } from '@maxmind/geoip2-node';
import type { WebServiceClientError } from '@maxmind/geoip2-node/dist/src/types.js';
import type { ProviderLocationInfo } from '../client.js';
import {
	normalizeCityName,
	normalizeCityNamePublic,
	normalizeNetworkName,
} from '../utils.js';
import { getCity } from '../city-approximation.js';
import { getRegionByCountry } from '../../location/location.js';
import { scopedLogger } from '../../logger.js';

const logger = scopedLogger('geoip:maxmind');
const client = new WebServiceClient(config.get('maxmind.accountId'), config.get('maxmind.licenseKey'));

export const isMaxmindError = (error: unknown): error is WebServiceClientError => error as WebServiceClientError['code'] !== undefined;

const query = async (addr: string, retryCounter = 0): Promise<City> => {
	try {
		const city = await client.city(addr);
		return city;
	} catch (error: unknown) {
		if (isMaxmindError(error)) {
			if ([ 'SERVER_ERROR', 'HTTP_STATUS_CODE_ERROR', 'INVALID_RESPONSE_BODY', 'FETCH_ERROR' ].includes(error.code) && retryCounter < 3) {
				return query(addr, retryCounter + 1);
			}

			if (error.code === 'ACCOUNT_ID_REQUIRED') {
				logger.error('Maxmind query error', new Error(error.error));
			}
		}

		throw error;
	}
};

export const maxmindLookup = async (addr: string): Promise<ProviderLocationInfo> => {
	const data = await query(addr);
	const originalCity = data.city?.names?.en || '';
	const originalState = data.country?.isoCode === 'US' ? data.subdivisions?.map(s => s.isoCode)[0] ?? '' : null;
	const { city, state } = await getCity({ city: originalCity, state: originalState }, data.country?.isoCode, data.location?.latitude, data.location?.longitude);

	return {
		provider: 'maxmind',
		continent: data.continent?.code ?? '',
		region: data.country?.isoCode ? getRegionByCountry(data.country?.isoCode) : '',
		country: data.country?.isoCode ?? '',
		state,
		city: normalizeCityNamePublic(city),
		normalizedCity: normalizeCityName(city),
		asn: data.traits?.autonomousSystemNumber ?? 0,
		latitude: data.location?.latitude ?? 0,
		longitude: data.location?.longitude ?? 0,
		network: data.traits?.isp ?? '',
		normalizedNetwork: normalizeNetworkName(data.traits?.isp ?? ''),
		isProxy: null,
		isHosting: null,
		isAnycast: data.traits?.isAnycast ?? null,
	};
};
