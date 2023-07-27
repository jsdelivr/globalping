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

let citiesMap: Map<string, City>;

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
		const { geonameId, population, latitude, longitude } = city;

		await redis.geoAdd('cities', [{
			member: `${geonameId},${population}`,
			latitude: parseFloat(latitude),
			longitude: parseFloat(longitude),
		}]);
	}));

	citiesMap = new Map(cities.map(city => ([ city.geonameId, city ])));
};

export const getApproximatedCity = async (latitude: number, longitude: number) => {
	const redis = getRedisClient();
	const keys = await redis.geoRadius('cities', { latitude, longitude }, 30, 'km');
	const locations = keys.map((key) => {
		const [ geonameId, population ] = key.split(',');
		return {
			geonameId: geonameId!,
			population: parseInt(population!, 10),
		};
	});
	const biggestLocation = _.maxBy(locations, 'population');

	if (!biggestLocation) {
		return null;
	}

	const biggestCity = citiesMap.get(biggestLocation.geonameId);

	if (!biggestCity) {
		throw new Error(`Unable to find geoname id: ${biggestLocation.geonameId}`);
	}

	return biggestCity;
};
