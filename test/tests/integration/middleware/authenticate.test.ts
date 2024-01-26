import type { Server } from 'node:http';
import { expect } from 'chai';
import nock from 'nock';
import request, { type Agent } from 'supertest';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { addFakeProbe, deleteFakeProbes, getTestServer } from '../../../utils/server.js';
import { client } from '../../../../src/lib/sql/client.js';
import { auth, GP_TOKENS_TABLE, Token } from '../../../../src/lib/http/auth.js';

describe('authenticate', () => {
	let app: Server;
	let requestAgent: Agent;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
		nockGeoIpProviders();
		const probe = await addFakeProbe();
		probe.emit('probe:status:update', 'ready');
	});

	beforeEach(async () => {
		await client(GP_TOKENS_TABLE).where({ value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=' }).delete();
		await auth.syncTokens();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
	});

	it('should accept if no "Authorization" header was passed', async () => {
		await requestAgent.post('/v1/measurements')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(202);
	});

	it('should accept if valid token was passed', async () => {
		await client(GP_TOKENS_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
		});

		await auth.syncTokens();

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(202);
	});

	it('should accept if origin is correct', async () => {
		await client(GP_TOKENS_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			origins: JSON.stringify([ 'https://jsdelivr.com' ]),
		});

		await auth.syncTokens();

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4')
			.set('Origin', 'https://jsdelivr.com')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(202);
	});

	it('should update "date_last_used" field', async () => {
		await client(GP_TOKENS_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
		});

		await auth.syncTokens();

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(202);

		const tokens = await client(GP_TOKENS_TABLE).select<Token[]>([ 'date_last_used' ]).where({
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
		});

		const currentDate = new Date();
		currentDate.setHours(0, 0, 0, 0);
		expect(tokens[0]?.date_last_used?.toString()).to.equal(currentDate.toString());
	});

	it('should get token from db if it is not synced yet', async () => {
		await client(GP_TOKENS_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
		});

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(202);
	});

	it('should reject with 401 if invalid token was passed', async () => {
		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'invalidValue')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(401);
	});

	it('should reject if token is expired', async () => {
		await client(GP_TOKENS_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			expire: new Date('01-01-2024'),
		});

		await auth.syncTokens();

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(401);
	});

	it('should reject if previously not synced token is expired', async () => {
		await client(GP_TOKENS_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			expire: new Date('01-01-2024'),
		});

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(401);
	});

	it('should reject if origin is wrong', async () => {
		await client(GP_TOKENS_TABLE).insert({
			user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			origins: JSON.stringify([ 'https://jsdelivr.com' ]),
		});

		await auth.syncTokens();

		await requestAgent.post('/v1/measurements')
			.set('Authorization', 'Bearer VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4')
			.send({
				type: 'ping',
				target: 'example.com',
			})
			.expect(401);
	});
});
