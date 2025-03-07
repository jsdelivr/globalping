import got from 'got';
import { expect } from 'chai';
import { client } from '../../../src/lib/sql/client.js';
import { waitProbeInCity } from '../utils.js';

const ADOPTIONS_TABLE = 'gp_probes';

describe('adopted probe', () => {
	before(async function () {
		this.timeout(80000);

		await client(ADOPTIONS_TABLE).insert({
			userId: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			lastSyncDate: new Date(),
			ip: '51.158.22.211',
			uuid: '1-1-1-1-1',
			isCustomCity: 1,
			tags: '[{"prefix":"jimaek","value":"dashboardtag1"}]',
			status: 'ready',
			isIPv4Supported: true,
			isIPv6Supported: true,
			version: '0.28.0',
			nodeVersion: 'v18.14.2',
			country: 'FR',
			countryOfCustomCity: 'FR',
			city: 'Marseille',
			latitude: 43.3,
			longitude: 5.38,
			network: 'InterBS S.R.L. (BAEHOST)',
			asn: 61004,
		});

		await waitProbeInCity('Marseille');
	});

	after(async function () {
		this.timeout(80000);
		await client(ADOPTIONS_TABLE).where({ city: 'Marseille' }).delete();
		await waitProbeInCity('Paris');
	});

	it('should return probe list with updated city', async () => {
		const probes = await got('http://localhost:80/v1/probes').json<any>();

		expect(probes[0].location.city).to.equal('Marseille');
	});

	it('should create measurement by its new location', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: [{
				city: 'Marseille',
			}],
		} });

		expect(response.statusCode).to.equal(202);
	});

	it('should create measurement by user tag', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: [{
				tags: [ 'u-jimaek:dashboardtag1' ],
			}],
		} });

		expect(response.statusCode).to.equal(202);
	});

	it('should not create measurement by its old location', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: [{
				city: 'Paris',
			}],
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(422);
	});
});
