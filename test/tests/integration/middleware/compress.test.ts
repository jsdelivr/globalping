import type {Server} from 'node:http';
import request, {Response} from 'supertest';
import {expect} from 'chai';
import {addFakeProbe, deleteFakeProbe} from '../../../utils/ws.js';

import {getTestServer} from '../../../utils/http.js';

describe('compression', function () {
	this.timeout(15_000);

	let app: Server;
	let requestAgent: any;

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('headers', () => {
		before(async () => {
			for (const i of Array.from({length: 10}).keys()) {
				// eslint-disable-next-line no-await-in-loop
				await addFakeProbe(`us-${i}`, {location: {continent: 'NA', country: 'US', city: 'dallas', state: 'TX'}});
			}
		});

		after(() => {
			for (let i = 0; i < 10; i++) {
				deleteFakeProbe(`us-${i}`);
			}
		});

		it('should include compression headers', async () => {
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
