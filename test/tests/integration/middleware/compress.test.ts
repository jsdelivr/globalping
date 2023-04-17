import fs from 'node:fs';
import request, { type Response } from 'supertest';
import { expect } from 'chai';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import RedisCacheMock from '../../../mocks/redis-cache.js';

const nockMocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

describe('compression', () => {
	let addFakeProbe: () => Promise<Socket>;
	let deleteFakeProbe: (socket: Socket) => Promise<void>;
	let requestAgent: any;
	let probes: Socket[] = [];

	describe('headers', () => {
		before(async () => {
			await td.replaceEsm('../../../../src/lib/cache/redis-cache.ts', {}, RedisCacheMock);
			const http = await import('../../../utils/server.js');
			addFakeProbe = http.addFakeProbe;
			deleteFakeProbe = http.deleteFakeProbe;
			const app = await http.getTestServer();
			requestAgent = request(app);
		});

		after(async () => {
			nock.cleanAll();
			await Promise.all(probes.map(probe => deleteFakeProbe(probe)));
		});

		it('should include compression headers', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).times(10).reply(200, nockMocks['00.00'].fastly);
			nock('https://ipinfo.io').get(/.*/).times(10).reply(200, nockMocks['00.00'].ipinfo);
			nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).times(10).reply(200, nockMocks['00.00'].maxmind);
			probes = await Promise.all(Array.from({ length: 10 }).map(() => addFakeProbe()));

			for (const probe of probes) {
				probe.emit('probe:status:update', 'ready');
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent
				.get('/v1/probes')
				.set('accept-encoding', '*')
				.send() as Response;

			expect(response.headers['transfer-encoding']).to.equal('chunked');
			expect(response.headers['content-length']).to.not.exist;
		});
	});
});
