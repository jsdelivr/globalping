import request, { type Response } from 'supertest';
import { expect } from 'chai';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import { getTestServer, addFakeProbes, deleteFakeProbes, waitForProbesUpdate } from '../../../utils/server.js';
import geoIpMocks from '../../../mocks/nock-geoip.json' assert { type: 'json' };

describe('compression', () => {
	let requestAgent: any;
	let probes: Socket[] = [];

	describe('headers', () => {
		before(async () => {
			const app = await getTestServer();
			requestAgent = request(app);
		});

		after(async () => {
			nock.cleanAll();
			await deleteFakeProbes();
		});

		it('should include compression headers', async () => {
			nock('https://ipmap-api.ripe.net/v1/locate/').get(/.*/).times(3).reply(200, geoIpMocks.ipmap.default);
			nock('https://api.ip2location.io').get(/.*/).times(3).reply(200, geoIpMocks.ip2location.default);
			nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).times(3).reply(200, geoIpMocks.fastly.default);
			nock('https://ipinfo.io').get(/.*/).times(3).reply(200, geoIpMocks.ipinfo.default);
			nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).times(3).reply(200, geoIpMocks.maxmind.default);
			probes = await addFakeProbes(3);

			for (const probe of probes) {
				probe.emit('probe:status:update', 'ready');
			}

			await waitForProbesUpdate();

			const response = await requestAgent
				.get('/v1/probes')
				.set('accept-encoding', '*')
				.send() as Response;

			expect(response.headers['transfer-encoding']).to.equal('chunked');
			expect(response.headers['content-length']).to.not.exist;
		});
	});
});
