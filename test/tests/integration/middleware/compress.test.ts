import fs from 'node:fs';
import request, {type Response} from 'supertest';
import {expect} from 'chai';
import * as td from 'testdouble';
import nock from 'nock';
import RedisCacheMock from '../../../mocks/redis-cache.js';

const nockMocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

describe('compression', function () {
	this.timeout(15_000);

	let addFakeProbe;
	let deleteFakeProbe;
	let requestAgent: any;

	describe('headers', () => {
		before(async () => {
			await td.replaceEsm('../../../../src/lib/cache/redis-cache.ts', {}, RedisCacheMock);
			const http = await import('../../../utils/http.js');
			addFakeProbe = http.addFakeProbe;
			deleteFakeProbe = http.deleteFakeProbe;
			const app = await http.getTestServer();
			requestAgent = request(app);
		});

		it('should include compression headers', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).times(10).reply(200, nockMocks['00.00'].fastly);
			nock('https://ipinfo.io').get(/.*/).times(10).reply(200, nockMocks['00.00'].ipinfo);
			nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).times(10).reply(200, nockMocks['00.00'].maxmind);
			const probes = await Promise.all(Array.from({length: 10}).map(() => addFakeProbe()));

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const response = await requestAgent
				.get('/v1/probes')
				.set('accept-encoding', '*')
				.send() as Response;

			expect(response.headers['transfer-encoding']).to.equal('chunked');
			expect(response.headers['content-length']).to.not.exist;

			await Promise.all(probes.map(probe => deleteFakeProbe(probe)));
		});
	});
});
