import got from 'got';
import { expect } from 'chai';

import { waitMesurementFinish, waitProbeToConnect } from '../utils.js';
import { startProbeContainer, stopProbeContainer } from '../docker.js';

describe('api', () => {
	beforeEach(async () => {
		await startProbeContainer();
		await waitProbeToConnect();
	});

	after(async () => {
		await startProbeContainer();
		await waitProbeToConnect();
	});

	it('should create measurement with "offline" result if requested probe is not connected', async () => {
		const { id: locationId } = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} }).json();

		await stopProbeContainer();

		const { id } = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: locationId,
		} }).json();

		const { response, body } = await waitMesurementFinish(id);

		expect(body.status).to.equal('finished');
		expect(body.results[0].result.status).to.equal('offline');
		expect(response).to.matchApiSchema();
	});

	it('should create measurement with "failed" result if probe failed to send result', async () => {
		const { id } = await got.post('http://localhost:3000/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} }).json();

		await stopProbeContainer();

		const { response, body } = await waitMesurementFinish(id);

		expect(body.status).to.equal('finished');
		expect(body.results[0].result.status).to.equal('failed');
		expect(body.results[0].result.rawOutput).to.equal('\n\nThe measurement timed out');
		expect(response).to.matchApiSchema();
	}).timeout(40000);
});
