import config from 'config';
import {WebServiceClient} from '@maxmind/geoip2-node';
import {LocationInfo, normalizeCityName} from './client.js';

const client = new WebServiceClient(config.get('maxmind.accountId'), config.get('maxmind.licenseKey'));

export const maxmindLookup = async (addr: string): Promise<LocationInfo> => {
	const data = await client.city(addr);

	if (!data) {
		throw new Error('no maxmind data');
	}

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
