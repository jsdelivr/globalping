import { expect } from 'chai';
import request from 'supertest';
import nock from 'nock';
import { getTestServer } from '../../../utils/server.js';
import type { Server } from 'node:http';

describe('blacklist middleware', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	after(() => {
		nock.cleanAll();
	});

	it('should pass (ok ip)', async () => {
		const res = await requestAgent.get('/').set('X-Forwarded-For', '127.0.0.1');
		expect(res.status).to.not.equal(403);
	});

	it('should pass (ok IPv4-mapped IPv6)', async () => {
		const res = await requestAgent.get('/').set('X-Forwarded-For', '::ffff:127.0.0.1');
		expect(res.status).to.not.equal(403);
	});

	it('should fail (blacklisted IPv4-mapped IPv6)', async () => {
		const res = await requestAgent.get('/').set('X-Forwarded-For', '::ffff:100.33.75.218');

		expect(res.status).to.equal(403);
		expect(res.body?.error).to.exist;
		expect(res.body.error.type).to.equal('access_forbidden');
		expect(res.body.error.message).to.equal('Access from 100.33.75.218 has been forbidden for security reasons.');
	});

	it('should fail (blacklisted ip)', async () => {
		const res = await requestAgent.get('/').set('X-Forwarded-For', '100.33.75.218');

		expect(res.status).to.equal(403);
		expect(res.body?.error).to.exist;
		expect(res.body.error.type).to.equal('access_forbidden');
		expect(res.body.error.message).to.equal('Access from 100.33.75.218 has been forbidden for security reasons.');
	});
});
