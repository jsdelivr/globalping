import fs from 'node:fs';
import type {Server} from 'node:http';
import {expect} from 'chai';
import request, {SuperTest, Test} from 'supertest';
import type {Probe} from '../../../../src/probes/types.js';
import {getTestServer} from '../../../utils/http.js';
import {addFakeProbe, deleteFakeProbe} from '../../../utils/ws.js';

const mocks = JSON.parse(fs.readFileSync('./test/mocks/probes.json').toString()) as Record<string, Probe>;

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const probeToPublicProbe = (probe: Probe) => {
	const {version, ready, resolvers, location} = probe;

	return {
		version,
		ready,
		resolvers,
		location: {
			continent: location.continent,
			region: location.region,
			country: location.country,
			...(location.state ? {state: location.state} : {}),
			city: location.city,
			asn: location.asn,
			latitude: location.latitude,
			longitude: location.longitude,
			network: location.network,
		},
	};
};
/* eslint-enable @typescript-eslint/no-unsafe-assignment */

describe('Get Probes', function () {
	this.timeout(15_000);

	let app: Server;
	let requestAgent: SuperTest<Test>;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('probes not connected', () => {
		it('should respond with an empty array', async () => {
			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect(response => {
					expect(response.body).to.deep.equal([]);
				});
		});
	});

	describe('probes connected', () => {
		it('should detect 1 probe', async () => {
			const probeId = 'as-jakarta-01';
			await addFakeProbe(probeId, mocks[probeId]);

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect(response => {
					expect(response.body).to.deep.equal([
						probeToPublicProbe(mocks[probeId]),
					]);
				});

			deleteFakeProbe(probeId);
		});

		it('should detect 2 probes', async () => {
			const probeIds = ['as-jakarta-01', 'sa-sao-paulo-01'];

			await Promise.all(probeIds.map(async k => addFakeProbe(k, mocks[k])));

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect(response => {
					expect(response.body).to.deep.equal([
						...probeIds.map(k => probeToPublicProbe(mocks[k])),
					]);
				});

			for (const key of probeIds) {
				deleteFakeProbe(key);
			}
		});

		it('should detect 3 probes', async () => {
			const probeIds = ['as-jakarta-01', 'sa-sao-paulo-01', 'eu-moscow-01'];

			await Promise.all(probeIds.map(async k => addFakeProbe(k, mocks[k])));

			await requestAgent.get('/v1/probes')
				.send()
				.expect(200)
				.expect(response => {
					expect(response.body).to.deep.equal([
						...probeIds.map(k => probeToPublicProbe(mocks[k])),
					]);
				});

			for (const key of probeIds) {
				deleteFakeProbe(key);
			}
		});
	});
});
