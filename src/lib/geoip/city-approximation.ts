import got from 'got';
import AdmZip from 'adm-zip';

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
