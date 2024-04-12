import got from 'got';
import { expect } from 'chai';
import { client } from '../../../src/lib/sql/client.js';
import { waitProbeInCity } from '../utils.js';

const LOCATION_OVERRIDES_TABLE = 'gp_location_overrides';

describe('location overrides', () => {
	before(async function () {
		this.timeout(80000);

		await client(LOCATION_OVERRIDES_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			date_created: new Date(),
			user_updated: null,
			date_updated: null,
			ip_range: '51.158.22.0/24',
			country: 'US',
			state: 'FL',
			city: 'Miami',
			latitude: 25.7743,
			longitude: -80.1937,
		});

		await waitProbeInCity('Miami');
	});

	after(async function () {
		this.timeout(80000);
		await client(LOCATION_OVERRIDES_TABLE).where({ city: 'Miami' }).delete();
		await waitProbeInCity('Paris');
	});

	it('should return probe list with updated location', async () => {
		const probes = await got('http://localhost:80/v1/probes').json<any>();

		expect(probes[0].location).to.include({
			continent: 'NA',
			region: 'Northern America',
			country: 'US',
			state: 'FL',
			city: 'Miami',
			latitude: 25.7743,
			longitude: -80.1937,
		});
	});

	it('should create measurement by its new location', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: [{
				city: 'Miami',
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
