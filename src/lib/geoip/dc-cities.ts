import dcCitiesJson from '../../../config/dc-cities.json' assert { type: 'json' };

const dcCountries = new Map(dcCitiesJson.map(({ country, cities }) => [ country, new Set(cities) ]));

export const getIsDcCity = (city: string, country?: string) => {
	if (!country || !city) {
		return false;
	}

	const cities = dcCountries.get(country);

	if (!cities) {
		return false;
	}

	return cities.has(city);
};
