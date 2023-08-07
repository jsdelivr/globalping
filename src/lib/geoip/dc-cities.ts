
import dcCitiesJson from './dc-cities.json' assert { type: 'json' };
import { normalizeCityName } from './utils';

const dcCountries = new Map(dcCitiesJson.map(({ country, cities }) => {
	return [ country, new Set(cities.map(city => normalizeCityName(city))) ];
}));

export const getIsDcCity = (city: string, country?: string) => {
	if (!country || !city) {
		return false;
	}

	const cities = dcCountries.get(country);

	if (!cities) {
		return false;
	}

	return cities.has(normalizeCityName(city));
};
