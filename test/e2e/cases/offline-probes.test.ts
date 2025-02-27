import got from 'got';
import { expect } from 'chai';

import { waitMeasurementFinish, waitProbeToConnect, waitProbeToDisconnect } from '../utils.js';
import { docker } from '../docker.js';

describe('api', () => {
	beforeEach(async function () {
		this.timeout(60000);
		await docker.startProbeContainer();
		await waitProbeToConnect();
	});

	after(async function () {
		this.timeout(60000);
		await docker.startProbeContainer();
		await waitProbeToConnect();
	});

	it('should create measurement with "offline" result if requested probe is not connected', async () => {
		const { id: locationId } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} }).json<any>();

		await docker.stopProbeContainer();
		await waitProbeToDisconnect();

		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: locationId,
		} }).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('offline');
		expect(response).to.matchApiSchema();
	});

	it('should create measurement with "failed" result if probe failed to send result', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} }).json<any>();

		await docker.stopProbeContainer();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('failed');
		expect(response.body.results[0].result.rawOutput).to.equal('\n\nThe measurement timed out.');
		expect(response).to.matchApiSchema();
	}).timeout(40000);
});
