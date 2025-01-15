import type { Server } from 'node:http';
import { expect } from 'chai';
import nock from 'nock';
import config from 'config';
import { SignJWT } from 'jose';
import request, { type Agent } from 'supertest';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { addFakeProbe, deleteFakeProbes, getTestServer, waitForProbesUpdate } from '../../../utils/server.js';
import { client } from '../../../../src/lib/sql/client.js';
import { auth, GP_TOKENS_TABLE, Token } from '../../../../src/lib/http/auth.js';
import type { AuthenticateOptions } from '../../../../src/lib/http/middleware/authenticate.js';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

describe('authenticate', () => {
	let app: Server;
	let requestAgent: Agent;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
		nockGeoIpProviders();
		const probe = await addFakeProbe();
		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();
	});

	beforeEach(async () => {
		await client(GP_TOKENS_TABLE).where({ value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=' }).delete();
		await auth.syncTokens();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
	});

	describe('token', () => {
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
				name: 'test token',
				user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
				value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			});

			await auth.syncTokens();

			await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer hf2fnprguymlgliirdk7qv23664c2xcr')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(202);
		});

		it('should accept if origin is correct', async () => {
			await client(GP_TOKENS_TABLE).insert({
				name: 'test token',
				user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
				value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
				origins: JSON.stringify([ 'https://jsdelivr.com' ]),
			});

			await auth.syncTokens();

			await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer hf2fnprguymlgliirdk7qv23664c2xcr')
				.set('Origin', 'https://jsdelivr.com')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(202);
		});

		it('should update "date_last_used" field', async () => {
			await client(GP_TOKENS_TABLE).insert({
				name: 'test token',
				user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
				value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			});

			await auth.syncTokens();

			await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer hf2fnprguymlgliirdk7qv23664c2xcr')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(202);

			const tokens = await client(GP_TOKENS_TABLE).select<Token[]>([ 'date_last_used' ]).where({
				value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			});

			const currentDate = new Date();
			currentDate.setHours(0, 0, 0, 0);
			expect(tokens[0]?.date_last_used?.toString()).to.equal(currentDate.toString());
		});

		it('should get token from db if it is not synced yet', async () => {
			await client(GP_TOKENS_TABLE).insert({
				name: 'test token',
				user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
				value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			});

			await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer hf2fnprguymlgliirdk7qv23664c2xcr')
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
				name: 'test token',
				user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
				value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
				expire: new Date('01-01-2024'),
			});

			await auth.syncTokens();

			await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer hf2fnprguymlgliirdk7qv23664c2xcr')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(401);
		});

		it('should reject if previously not synced token is expired', async () => {
			await client(GP_TOKENS_TABLE).insert({
				name: 'test token',
				user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
				value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
				expire: new Date('01-01-2024'),
			});

			await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer hf2fnprguymlgliirdk7qv23664c2xcr')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(401);
		});

		it('should reject if origin is wrong', async () => {
			await client(GP_TOKENS_TABLE).insert({
				name: 'test token',
				user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
				value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
				origins: JSON.stringify([ 'https://jsdelivr.com' ]),
			});

			await auth.syncTokens();

			await requestAgent.post('/v1/measurements')
				.set('Authorization', 'Bearer hf2fnprguymlgliirdk7qv23664c2xcr')
				.send({
					type: 'ping',
					target: 'example.com',
				})
				.expect(401);
		});
	});

	describe('cookie', () => {
		const sessionKey = Buffer.from(sessionConfig.cookieSecret);

		it('should accept if valid cookie was passed', async () => {
			const jwt = await new SignJWT({
				id: 'cookie-user-id',
				app_access: 1,
			}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);

			const response = await requestAgent.post('/v1/measurements')
				.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
				.send({
					type: 'ping',
					target: 'example.com',
				});

			expect(response.status).to.equal(202);
			expect(response.headers['x-ratelimit-limit']).to.equal('500');
		});

		it('should ignore if cookie without app_access was passed', async () => {
			const jwt = await new SignJWT({
				id: 'cookie-user-id',
			}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);

			const response = await requestAgent.post('/v1/measurements')
				.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
				.send({
					type: 'ping',
					target: 'example.com',
				});

			expect(response.status).to.equal(202);
			expect(response.headers['x-ratelimit-limit']).to.equal('250');
		});

		it('should ignore if invalid cookie was passed', async () => {
			const jwt = await new SignJWT({
				id: 'cookie-user-id',
			}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);

			const response = await requestAgent.post('/v1/measurements')
				.set('Cookie', `${sessionConfig.cookieName}=${jwt.slice(-1)}`)
				.send({
					type: 'ping',
					target: 'example.com',
				});

			expect(response.status).to.equal(202);
			expect(response.headers['x-ratelimit-limit']).to.equal('250');
		});

		it('should ignore if cookie signed with a different key was passed', async () => {
			const jwt = await new SignJWT({
				id: 'cookie-user-id',
			}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(Buffer.from('!'));

			const response = await requestAgent.post('/v1/measurements')
				.set('Cookie', `${sessionConfig.cookieName}=${jwt}`)
				.send({
					type: 'ping',
					target: 'example.com',
				});

			expect(response.status).to.equal(202);
			expect(response.headers['x-ratelimit-limit']).to.equal('250');
		});
	});
});
