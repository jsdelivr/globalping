import config from 'config';
import {City, WebServiceClient} from '@maxmind/geoip2-node';
import type {WebServiceClientError} from '@maxmind/geoip2-node/dist/src/types';
import appsignal from '../appsignal.js';
import {normalizeCityName} from './client.js';
import type {LocationInfo} from './types.js';

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
				appsignal.tracer().sendError(new Error(error.error), span => {
					span.setName('geoip.lookup');
					span.set('client', 'maxmind');
				});
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
		city: normalizeCityName(data.city?.names?.en ?? ''),
		asn: data.traits?.autonomousSystemNumber ?? 0,
		latitude: data.location?.latitude ?? 0,
		longitude: data.location?.longitude ?? 0,
		network: data.traits?.autonomousSystemOrganization ?? '',
	};
};
