import got from 'got';
import { expect } from 'chai';
import { client } from '../../../src/lib/sql/client.js';
import { waitProbeInCity } from '../utils.js';
import { randomUUID } from 'crypto';

const PROBES_TABLE = 'gp_probes';

describe('adopted probes', () => {
	before(async function () {
		this.timeout(80000);

		await client('directus_users').delete();

		await client('directus_users').insert({
			id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			adoption_token: 'adoptionTokenValue',
			github_username: 'jimaek',
			github_organizations: JSON.stringify([ 'jsdelivr' ]),
			default_prefix: 'jsdelivr',
			public_probes: true,
		});

		await client(PROBES_TABLE).delete();

		await client(PROBES_TABLE).insert({
			id: randomUUID(),
			userId: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			lastSyncDate: new Date(),
			ip: '1.2.3.4',
			uuid: '1-1-1-1-1',
			tags: '[{"prefix":"jimaek","value":"dashboardtag1"}]',
			status: 'ready',
			isIPv4Supported: true,
			isIPv6Supported: true,
			version: '0.39.0',
			nodeVersion: 'v18.14.2',
			country: 'AR',
			city: 'San Luis',
			latitude: -33.3,
			longitude: -66.34,
			network: 'InterBS S.R.L. (BAEHOST)',
			asn: 61003,
			allowedCountries: '["AR"]',
			customLocation: JSON.stringify({
				country: 'AR',
				city: 'San Luis',
				latitude: -33.3,
				longitude: -66.34,
				state: null,
			}),
		});

		await waitProbeInCity('San Luis');
	});

	after(async function () {
		this.timeout(80000);
		await client(PROBES_TABLE).delete();
		await waitProbeInCity('Buenos Aires');
	});

	it('should return probe list with updated city', async () => {
		const probes = await got('http://localhost:80/v1/probes').json<any>();

		expect(probes[0].location.city).to.equal('San Luis');
	});

	it('should create measurement by its new location', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'ping',
				locations: [{
					city: 'San Luis',
				}],
			},
		});

		expect(response.statusCode).to.equal(202);
	});

	it('should not create measurement by its old location', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'ping',
				locations: [{
					city: 'Buenos Aires',
				}],
			},
			throwHttpErrors: false,
		});

		expect(response.statusCode).to.equal(422);
	});

	it('should create measurement by assigneduser tag', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'ping',
				locations: [{
					tags: [ 'u-jimaek:dashboardtag1' ],
				}],
			},
		});

		expect(response.statusCode).to.equal(202);
	});

	it('should create measurement by global user tag', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'ping',
				locations: [{
					tags: [ 'u-jsdelivr' ],
				}],
			},
		});

		expect(response.statusCode).to.equal(202);
	});
});
