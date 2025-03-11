import { expect } from 'chai';
import { client } from '../../../src/lib/sql/client.js';
import { waitRowInTable } from '../utils.js';

const ADOPTIONS_TABLE = 'gp_probes';

describe('probes sync', () => {
	it('should insert new probe row to sql table', async () => {
		await client(ADOPTIONS_TABLE).delete();
		const row = await waitRowInTable(ADOPTIONS_TABLE);
		expect(row).to.include({
			date_updated: null,
			userId: null,
			ip: '1.2.3.4',
			altIps: '[]',
			isCustomCity: 0,
			tags: '[]',
			systemTags: '[]',
			hardwareDevice: null,
			hardwareDeviceFirmware: null,
			country: 'AR',
			city: 'Buenos Aires',
			state: null,
			latitude: -34.61,
			longitude: -58.38,
			asn: 61003,
			network: 'InterBS S.R.L. (BAEHOST)',
			countryOfCustomCity: null,
		});
	});
});
