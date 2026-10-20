import nock from 'nock';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { expect } from 'chai';
import { addFakeProbe, deleteFakeProbes, getIoContext, getTestServer } from '../../../utils/server.js';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { dashboardClient } from '../../../../src/lib/sql/client.js';
import { createOrg, createUser } from '../../../utils/fixtures.js';

const NOTIFICATIONS_TABLE = 'directus_notifications';
const PROBE_UUID = '11111111-1111-4111-8111-111111111111';

describe('Probe location notifications', () => {
	let firstAdmin: { id: string; accountId: string };
	let secondAdmin: { id: string; accountId: string };
	let org: { id: string; accountId: string };

	// The probe sits in Portugal with a custom city there, while the API sees it in the US.
	const insertProbe = () => dashboardClient('gp_probes').insert({
		id: randomUUID(),
		uuid: PROBE_UUID,
		ip: '1.2.3.4',
		name: 'org-probe',
		account_id: org.accountId,
		status: 'ready',
		version: '0.39.0',
		nodeVersion: 'v18.17.0',
		lastSyncDate: new Date(),
		city: 'Lisbon',
		country: 'PT',
		countryName: 'Portugal',
		continent: 'EU',
		continentName: 'Europe',
		region: 'Southern Europe',
		latitude: 38.72,
		longitude: -9.14,
		asn: 20004,
		network: 'The Constant Company',
		allowedCountries: JSON.stringify([ 'PT' ]),
		customLocation: JSON.stringify({ country: 'PT', city: 'Lisbon', latitude: 38.72, longitude: -9.14, state: null }),
	});

	before(async () => {
		await getTestServer();

		// Writing back to the dashboard is off by default in tests (SHOULD_SYNC_ADOPTIONS), and it is what sends these.
		(getIoContext().adoptedProbes as unknown as { syncBackToDashboard: boolean }).syncBackToDashboard = true;

		[ firstAdmin, secondAdmin ] = await Promise.all([ createUser(dashboardClient), createUser(dashboardClient) ]);

		org = await createOrg(dashboardClient, {
			members: [{ userId: firstAdmin.id, role: 'admin' }, { userId: secondAdmin.id, role: 'admin' }],
		});
	});

	afterEach(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
		await dashboardClient('gp_probes').delete();
		await dashboardClient(NOTIFICATIONS_TABLE).delete();
	});

	after(async () => {
		(getIoContext().adoptedProbes as unknown as { syncBackToDashboard: boolean }).syncBackToDashboard = false;

		await dashboardClient('gp_accounts').whereIn('id', [ firstAdmin.accountId, secondAdmin.accountId, org.accountId ]).delete();
		await dashboardClient('gp_orgs').where({ id: org.id }).delete();
		await dashboardClient('directus_users').whereIn('id', [ firstAdmin.id, secondAdmin.id ]).delete();
	});

	it('should address the notification to the account that owns the probe', async () => {
		await insertProbe();
		nockGeoIpProviders();
		await addFakeProbe({}, { query: { uuid: PROBE_UUID } });

		let payload: { account?: string; type?: string } | undefined;

		nock('https://dash-directus.globalping.io').post('/notifications', (body) => {
			payload = body as typeof payload;
			return true;
		}).reply(200);

		await getIoContext().adoptedProbes.syncDashboardData();
		await setTimeout(100);

		expect(payload?.account).to.equal(org.accountId);
		expect(payload?.type).to.equal('probe_location_changed');
	});

	it('should not repeat the notification an admin of the account already got today', async () => {
		await insertProbe();
		nockGeoIpProviders();
		await addFakeProbe({}, { query: { uuid: PROBE_UUID } });

		let message = '';

		nock('https://dash-directus.globalping.io').post('/notifications', (body) => {
			message = (body as { message: string }).message;
			return true;
		}).reply(200);

		await getIoContext().adoptedProbes.syncDashboardData();
		await setTimeout(100);
		expect(message).to.not.equal('');

		// Directus fans an org notification out to its admins; here only the second one has it.
		await dashboardClient(NOTIFICATIONS_TABLE).insert({
			id: randomUUID().slice(0, 10),
			recipient: secondAdmin.id,
			subject: 'subject',
			message,
			timestamp: new Date(),
		});

		// Put the probe back where it was, so the next sync produces the very same message.
		await dashboardClient('gp_probes').where({ uuid: PROBE_UUID }).update({ country: 'PT', countryName: 'Portugal' });

		const secondAttempt = nock('https://dash-directus.globalping.io').post('/notifications').reply(200);

		await getIoContext().adoptedProbes.syncDashboardData();
		await setTimeout(100);

		expect(secondAttempt.isDone()).to.equal(false);
	});
});
