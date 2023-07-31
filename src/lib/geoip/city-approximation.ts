import fs from 'node:fs';
import got from 'got';
import AdmZip from 'adm-zip';
import csvParser from 'csv-parser';
import _ from 'lodash';
import { getRedisClient, RedisClient } from '../redis/client';

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
	population: number
	elevation: string
	dem: string
	timezone: string
	modificationDate: string
}

type CsvCityRow = City & { population: string };

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

let redis: RedisClient;
let geonamesCities: Map<string, City> = new Map();

export const populateCitiesList = async () => {
	redis = getRedisClient();
	const cities = await readCitiesCsvFile() as CsvCityRow[];

	geonamesCities = new Map(cities.map(city => ([ city.geonameId, { ...city, population: parseInt(city.population, 10) }])));

	await Promise.all(cities.map(async (city: City) => {
		const { geonameId, latitude, longitude } = city;

		await redis.geoAdd('gp:cities', [{
			member: geonameId,
			latitude: parseFloat(latitude),
			longitude: parseFloat(longitude),
		}]);
	}));
};

export const getApproximatedCity = async (country?: string, latitude?: number, longitude?: number) => {
	if (geonamesCities.size === 0 || !redis) {
		throw new Error('City approximation is not initialized.');
	}

	if (!country || !latitude || !longitude) {
		return null;
	}

	const geonameIds = await redis.geoSearch('gp:cities', { latitude, longitude }, { radius: 30, unit: 'km' });
	const cities: City[] = [];

	for (const geonameId of geonameIds) {
		const city = geonamesCities.get(geonameId);

		if (city && city.countryCode === country) {
			cities.push(city);
		}
	}

	const biggestCity = _.maxBy(cities, 'population');
	return biggestCity?.name ?? null;
};

const readCitiesCsvFile = () => new Promise((resolve, reject) => {
	const cities: CsvCityRow[] = [];
	fs.createReadStream(FILE_PATH)
		.pipe(csvParser({
			headers: [ 'geonameId', 'name', 'asciiName', 'alternateNames', 'latitude', 'longitude', 'featureClass', 'featureCode', 'countryCode', 'cc2', 'admin1Code', 'admin2Code', 'admin3Code', 'admin4Code', 'population', 'elevation', 'dem', 'timezone', 'modificationDate' ],
			separator: '\t',
		}))
		.on('data', (city: CsvCityRow) => {
			cities.push(city);
		})
		.on('end', () => resolve(cities))
		.on('error', err => reject(err));
});
