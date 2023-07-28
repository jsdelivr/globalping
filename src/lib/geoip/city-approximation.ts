import fs from 'node:fs';
import got from 'got';
import AdmZip from 'adm-zip';
import csvParser from 'csv-parser';
import _ from 'lodash';
import { getRedisClient } from '../redis/client';

type City = {
	geonameId: string
	name: string
	asciiName: string
	alternateNames: string
	latitude: string
	longitude: string
	featureClass: string
	featureCode: string
	countryCode: string
	cc2: string
	admin1Code: string
	admin2Code: string
	admin3Code: string
	admin4Code: string
	population: string
	elevation: string
	dem: string
	timezone: string
	modificationDate: string
}

const FILE_PATH = 'data/GEONAMES-CITIES.csv';

const query = async (url: string): Promise<Buffer> => {
	const result = await got(url, {
		responseType: 'buffer',
		timeout: { request: 5000 },
	});

	return result.body;
};

export const updateGeonamesCitiesFile = async (): Promise<void> => {
	const response = await query('https://download.geonames.org/export/dump/cities15000.zip');
	const zip = new AdmZip(response);
	zip.extractEntryTo('cities15000.txt', 'data', false, true, false, 'GEONAMES-CITIES.csv');
};

const getCities = () => new Promise((resolve, reject) => {
	const cities: City[] = [];
	fs.createReadStream(FILE_PATH)
		.pipe(csvParser({
			headers: [ 'geonameId', 'name', 'asciiName', 'alternateNames', 'latitude', 'longitude', 'featureClass', 'featureCode', 'countryCode', 'cc2', 'admin1Code', 'admin2Code', 'admin3Code', 'admin4Code', 'population', 'elevation', 'dem', 'timezone', 'modificationDate' ],
			separator: '\t',
		}))
		.on('data', (city: City) => {
			cities.push(city);
		})
		.on('end', () => resolve(cities))
		.on('error', err => reject(err));
});

export const populateCitiesList = async () => {
	const redis = getRedisClient();
	const cities = await getCities() as City[];

	// Save coordinates
	await Promise.all(cities.map(async (city: City) => {
		const { countryCode, name, population, latitude, longitude } = city;

		await redis.geoAdd('cities', [{
			member: `${countryCode},${name},${population}`,
			latitude: parseFloat(latitude),
			longitude: parseFloat(longitude),
		}]);
	}));
};

export const getApproximatedCity = async (country?: string, latitude?: number, longitude?: number) => {
	if (!country || !latitude || !longitude) {
		return null;
	}

	const redis = getRedisClient();
	const keys = await redis.geoSearch('cities', { latitude, longitude }, { radius: 30, unit: 'km' });
	const cities = keys.map((key) => {
		const [ countryCode, name, population ] = key.split(',') as [string, string, string];
		return {
			countryCode,
			name,
			population: parseInt(population, 10),
		};
	});

	const citiesInTheSameCountry = cities.filter(location => location.countryCode === country);
	const biggestCity = _.maxBy(citiesInTheSameCountry, 'population');
	return biggestCity?.name ?? null;
};
