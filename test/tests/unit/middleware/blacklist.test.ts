import { expect } from 'chai';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nock from 'nock';

import { sourceList as ipSourceList, updateList as updateListIp } from '../../../../src/lib/malware/ip.js';
import { getTestServer } from '../../../utils/server.js';
import type { Server } from 'node:http';

const mockDataPath = path.join(path.resolve(), 'test/mocks/malware');
const ipMockResult = await readFile(path.join(mockDataPath, 'nock-ip.txt'), 'utf8');

describe('blacklist middleware', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		for (const source of ipSourceList) {
			const url = new URL(source);
			nock(url.origin).get(url.pathname).reply(200, ipMockResult);
		}

		await updateListIp();

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
		expect(res.body.error.message).to.equal('Access from ::ffff:100.33.75.218 has been forbidden for security reasons.');
	});

	it('should fail (blacklisted ip)', async () => {
		const res = await requestAgent.get('/').set('X-Forwarded-For', '100.33.75.218');

		expect(res.status).to.equal(403);
		expect(res.body?.error).to.exist;
		expect(res.body.error.type).to.equal('access_forbidden');
		expect(res.body.error.message).to.equal('Access from 100.33.75.218 has been forbidden for security reasons.');
	});
});
