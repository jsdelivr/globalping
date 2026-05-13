import type { Server } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import request, { type Response } from 'supertest';
import { expect } from 'chai';
import nock from 'nock';
import { getTestServer, addFakeProbe, deleteFakeProbes, waitForProbesUpdate } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { authenticatedRateLimiter as authenticatedPostRateLimiter } from '../../../src/lib/rate-limiter/rate-limiter-post.js';
import { dashboardClient } from '../../../src/lib/sql/client.js';
import { GP_TOKENS_TABLE } from '../../../src/lib/http/auth.js';
import { CREDITS_TABLE, credits } from '../../../src/lib/credits.js';

const USER_ID = '89da69bd-a236-4ab7-9c5d-b5f52ce09959';
const TOKEN_VALUE = 'Xj6kuKFEQ6zI60mr+ckHG7yQcIFGMJFzvtK9PBQ69y8=';

describe('low_credits notification', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);

		nockGeoIpProviders();
		nockGeoIpProviders();

		const probe1 = await addFakeProbe();
		const probe2 = await addFakeProbe();
		probe1.emit('probe:status:update', 'ready');
		probe1.emit('probe:isIPv4Supported:update', true);
		probe2.emit('probe:status:update', 'ready');
		probe2.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await dashboardClient('directus_users').insert({
			id: USER_ID,
			adoption_token: 'adoptionTokenValue',
			default_prefix: 'defaultPrefixValue',
			notification_preferences: JSON.stringify({ low_credits: { enabled: true, parameter: 5000 } }),
		});

		await dashboardClient(GP_TOKENS_TABLE).insert({
			name: 'test token',
			user_created: USER_ID,
			value: TOKEN_VALUE, // raw token: qz5kdukfcr3vggv3xbujvjwvirkpkkpx
		});

		await credits.syncPreferences();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
		await dashboardClient(GP_TOKENS_TABLE).where({ value: TOKEN_VALUE }).delete();
		await dashboardClient('directus_users').where({ id: USER_ID }).delete();
	});

	it('POSTs a notification to dash-directus when credits drop below threshold', async () => {
		await dashboardClient(CREDITS_TABLE).insert({ user_id: USER_ID, amount: 5001 })
			.onConflict().merge({ amount: 5001 });

		await authenticatedPostRateLimiter.set(USER_ID, 500, 0);

		let posted = false;

		nock('https://dash-directus.globalping.io')
			.post('/notifications', (body) => {
				expect(body).to.deep.include({ recipient: USER_ID, type: 'low_credits' });
				posted = true;
				return true;
			})
			.reply(200);

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
			.send({ type: 'ping', target: 'jsdelivr.com', limit: 2 })
			.expect(202) as Response;

		await setTimeout(50);
		expect(posted).to.equal(true);
	});

	it('does not POST a notification when remaining credits stay above threshold', async () => {
		await dashboardClient(CREDITS_TABLE).insert({ user_id: USER_ID, amount: 50000 })
			.onConflict().merge({ amount: 50000 });

		await authenticatedPostRateLimiter.set(USER_ID, 500, 0);

		let posted = false;

		nock('https://dash-directus.globalping.io')
			.post('/notifications')
			.reply(200, () => { posted = true; return {}; })
			.persist();

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer qz5kdukfcr3vggv3xbujvjwvirkpkkpx')
			.send({ type: 'ping', target: 'jsdelivr.com', limit: 2 })
			.expect(202) as Response;

		await setTimeout(50);
		expect(posted).to.equal(false);
	});
});
