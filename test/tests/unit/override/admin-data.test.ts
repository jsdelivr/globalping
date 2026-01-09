import { expect } from 'chai';
import sinon from 'sinon';
import { AdminData } from '../../../../src/lib/override/admin-data.js';
import type { Knex } from 'knex';
import type { SocketProbe } from '../../../../src/probe/types.js';

describe('AdminData', () => {
	const sandbox = sinon.createSandbox();
	const select = sandbox.stub();
	const sql = sandbox.stub().returns({ select }) as unknown as Knex;
	const probe = { ipAddress: '1.1.1.1', altIpAddresses: [], location: { city: 'Miami', state: 'FL', normalizedNetwork: 'm247', asn: 9009 }, normalizedTags: [] } as unknown as SocketProbe;

	let adminData = new AdminData(sql);

	const overrideLocation = {
		id: 1,
		user_created: '00b7776d-3bbc-4348-aab4-cf282b298a1b',
		date_created: new Date('2024-04-09'),
		user_updated: '00b7776d-3bbc-4348-aab4-cf282b298a1b',
		date_updated: new Date('2024-04-09'),
		ip_range: '1.1.1.1/32',
		city: 'Bydgoszcz',
		state: null,
		country: 'PL',
		latitude: 53.12,
		longitude: 18.01,
	};

	beforeEach(() => {
		select.reset();
		adminData = new AdminData(sql);
	});

	it('syncDashboardData method should populate admin location overrides', async () => {
		select.resolves([ overrideLocation ]);

		await adminData.syncDashboardData();
		const updatedProbes = adminData.getUpdatedProbes([
			probe,
			{ ...probe, ipAddress: '2.2.2.2' },
		]);

		expect(updatedProbes[0]).to.deep.equal({
			ipAddress: '1.1.1.1',
			altIpAddresses: [],
			location: {
				city: 'Bydgoszcz',
				state: null,
				continent: 'EU',
				region: 'Eastern Europe',
				normalizedCity: 'bydgoszcz',
				country: 'PL',
				latitude: 53.12,
				longitude: 18.01,
				allowedCountries: [ 'PL' ],
				asn: 9009,
				normalizedNetwork: 'm247',
			},
			normalizedTags: [],
			index: [
				[ 'pl' ],
				[ 'pol' ],
				[ 'poland' ],
				[],
				[ 'bydgoszcz' ],
				[],
				[],
				[],
				[ 'eu' ],
				[ 'europe' ],
				[ 'eastern europe' ],
				[ 'eastern europe', 'east europe' ],
				[ 'as9009' ],
				[],
				[ 'm247' ],
				[],
			],
		});

		expect(updatedProbes[1]).to.deep.equal({ ...probe, ipAddress: '2.2.2.2' });
	});

	it('syncDashboardData method should populate admin location overrides for alternativeIps', async () => {
		select.resolves([ overrideLocation ]);

		await adminData.syncDashboardData();
		const updatedProbes = adminData.getUpdatedProbes([
			{ ...probe, ipAddress: '2.2.2.2', altIpAddresses: [ '1.1.1.1' ] },
			{ ...probe, ipAddress: '3.3.3.3' },
		]);

		expect(updatedProbes[0]).to.deep.equal({
			ipAddress: '2.2.2.2',
			altIpAddresses: [ '1.1.1.1' ],
			location: {
				city: 'Bydgoszcz',
				continent: 'EU',
				region: 'Eastern Europe',
				normalizedCity: 'bydgoszcz',
				country: 'PL',
				state: null,
				latitude: 53.12,
				longitude: 18.01,
				allowedCountries: [ 'PL' ],
				asn: 9009,
				normalizedNetwork: 'm247',
			},
			normalizedTags: [],
			index: [
				[ 'pl' ],
				[ 'pol' ],
				[ 'poland' ],
				[],
				[ 'bydgoszcz' ],
				[],
				[],
				[],
				[ 'eu' ],
				[ 'europe' ],
				[ 'eastern europe' ],
				[ 'eastern europe', 'east europe' ],
				[ 'as9009' ],
				[],
				[ 'm247' ],
				[],
			],
		});

		expect(updatedProbes[1]).to.deep.equal({ ...probe, ipAddress: '3.3.3.3' });
	});

	it('syncDashboardData method should work for ip ranges', async () => {
		select.resolves([{ ...overrideLocation, ip_range: '1.1.1.1/8' }]);

		await adminData.syncDashboardData();
		const updatedProbes = adminData.getUpdatedProbes([
			{ ...probe, ipAddress: '1.200.210.220' },
			{ ...probe, ipAddress: '2.200.210.220' },
		]);

		expect(updatedProbes[0]?.location.city).to.deep.equal('Bydgoszcz');
		expect(updatedProbes[1]?.location.city).to.deep.equal('Miami');
	});

	it('getUpdatedLocation should return null if no override found', async () => {
		select.resolves([]);
		await adminData.syncDashboardData();
		const updatedLocation = adminData.getUpdatedLocation(probe);
		expect(updatedLocation).to.equal(null);
	});

	it('getUpdatedProbes method should use cached search results', async () => {
		select.resolves([ overrideLocation ]);

		const findUpdatedFieldsSpy = sandbox.spy(adminData, 'findUpdatedFields');
		await adminData.syncDashboardData();

		adminData.getUpdatedProbes([ probe ]);
		adminData.getUpdatedProbes([ probe ]);
		await adminData.syncDashboardData();
		adminData.getUpdatedProbes([ probe ]);
		expect(findUpdatedFieldsSpy.callCount).to.equal(1);
	});

	it('syncDashboardData method should reset cache if there is an update', async () => {
		select.resolves([ overrideLocation ]);

		const adminData = new AdminData(sql);
		const findUpdatedFieldsSpy = sandbox.spy(adminData, 'findUpdatedFields');
		await adminData.syncDashboardData();

		adminData.getUpdatedProbes([ probe ]);
		adminData.getUpdatedProbes([ probe ]);
		select.resolves([{ ...overrideLocation, date_updated: new Date('2024-04-10') }]);
		await adminData.syncDashboardData();
		adminData.getUpdatedProbes([ probe ]);
		adminData.getUpdatedProbes([ probe ]);
		expect(findUpdatedFieldsSpy.callCount).to.equal(2);
	});

	it('syncDashboardData method should reset cache if override was deleted', async () => {
		select.resolves([ overrideLocation ]);

		const adminData = new AdminData(sql);
		const findUpdatedFieldsSpy = sandbox.spy(adminData, 'findUpdatedFields');
		await adminData.syncDashboardData();

		adminData.getUpdatedProbes([ probe ]);
		adminData.getUpdatedProbes([ probe ]);
		select.resolves([]);
		await adminData.syncDashboardData();
		adminData.getUpdatedProbes([ probe ]);
		adminData.getUpdatedProbes([ probe ]);
		expect(findUpdatedFieldsSpy.callCount).to.equal(2);
	});
});
