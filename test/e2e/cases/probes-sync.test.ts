import { expect } from 'chai';
import { client } from '../../../src/lib/sql/client.js';
import { waitRowInTable } from '../utils.js';

const ADOPTIONS_TABLE = 'gp_probes';

describe('probes sync', () => {
	before(async () => {
		await client(ADOPTIONS_TABLE).delete();
	});

	it('should insert new probe row to sql table', async () => {
		const row = await waitRowInTable(ADOPTIONS_TABLE);
		expect(row).to.include({
			altIps: '[]',
			asn: 12876,
			city: 'Paris',
			country: 'FR',
			countryOfCustomCity: null,
			date_updated: null,
			hardwareDevice: null,
			hardwareDeviceFirmware: null,
			ip: '51.158.22.211',
			isCustomCity: 0,
			latitude: 48.85,
			longitude: 2.35,
			network: 'SCALEWAY S.A.S.',
			nodeVersion: 'v20.13.0',
			onlineTimesToday: 0,
			state: null,
			status: 'ready',
			systemTags: '[]',
			tags: '[]',
			userId: null,
			user_created: null,
			user_updated: null,
		});
	});
});
