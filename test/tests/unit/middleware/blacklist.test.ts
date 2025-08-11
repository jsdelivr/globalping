import { expect } from 'chai';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nock from 'nock';

import { sourceList as ipSourceList, updateList as updateListIp } from '../../../../src/lib/malware/ip.js';
import { sourceList as domainSourceList, updateList as updateListDomain } from '../../../../src/lib/malware/domain.js';
import { getTestServer } from '../../../utils/server.js';
import type { Server } from 'node:http';

const mockDataPath = path.join(path.resolve(), 'test/mocks/malware');

const ipMockResult = await readFile(path.join(mockDataPath, 'nock-ip.txt'), 'utf8');
const domainMockResult = await readFile(path.join(mockDataPath, 'nock-domain.txt'), 'utf8');


describe('blacklist middleware', () => {
	let app: Server;
	let requestAgent: any;

	before(async () => {
		for (const source of ipSourceList) {
			const url = new URL(source);
			nock(url.origin).get(url.pathname).reply(200, ipMockResult);
		}

		for (const source of domainSourceList) {
			const url = new URL(source);
			nock(url.origin).get(url.pathname).reply(200, domainMockResult);
		}

		await updateListIp();
		await updateListDomain();

		app = await getTestServer();
		requestAgent = request(app);
	});

	after(() => {
		nock.cleanAll();
	});

	const makeRequest = (xff: string, host?: string) => {
		const req = requestAgent.get('/');

		if (host) {
			req.set('Host', host);
		}

		return req.set('X-Forwarded-For', xff);
	};

	describe('ip', () => {
		it('should pass (ok ip)', async () => {
			const res = await makeRequest('127.0.0.1');
			expect(res.status).to.not.equal(403);
		});

		it('should fail (blacklisted ip)', async () => {
			const res = await makeRequest('100.33.75.218');

			expect(res.status).to.equal(403);
			expect(res.body?.error).to.exist;
			expect(res.body.error.type).to.equal('access_forbidden');
			expect(res.body.error.message).to.equal('Access from 100.33.75.218 has been forbidden for security reasons.');
		});

		it('should fail (blacklisted ip, ok domain)', async () => {
			const res = await makeRequest('100.33.75.218', 'google.com');

			expect(res.status).to.equal(403);
			expect(res.body?.error).to.exist;
			expect(res.body.error.type).to.equal('access_forbidden');
			expect(res.body.error.message).to.equal('Access from 100.33.75.218 has been forbidden for security reasons.');
		});

		it('should fail (blacklisted ip, blacklisted domain)', async () => {
			const res = await makeRequest('100.33.75.218', 'webdesignme.xyz');

			expect(res.status).to.equal(403);
			expect(res.body?.error).to.exist;
			expect(res.body.error.type).to.equal('access_forbidden');
			expect(res.body.error.message).to.equal('Access from 100.33.75.218 has been forbidden for security reasons.');
		});
	});

	describe('domain', () => {
		it('should pass (ok domain)', async () => {
			const res = await makeRequest('127.0.0.1', 'google.com');
			expect(res.status).to.not.equal(403);
		});

		it('should fail (blacklisted domain)', async () => {
			const res = await makeRequest('127.0.0.1', 'utenze-app-2022.net');

			expect(res.status).to.equal(403);
			expect(res.body?.error).to.exist;
			expect(res.body.error.type).to.equal('access_forbidden');
			expect(res.body.error.message).to.equal('Access from utenze-app-2022.net has been forbidden for security reasons.');
		});
	});
});
