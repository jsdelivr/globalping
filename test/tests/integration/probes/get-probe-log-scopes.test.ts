import { expect } from 'chai';
import request, { type Agent } from 'supertest';
import * as sinon from 'sinon';
import { getProbeLogScopesStorage } from '../../../../src/probe/log-scopes-storage.js';
import { getTestServer } from '../../../utils/server.js';

describe('Get Probe Log Scopes', () => {
	const sandbox = sinon.createSandbox();
	let requestAgent: Agent;

	before(async () => {
		requestAgent = request(await getTestServer());
	});

	afterEach(() => sandbox.restore());

	it('publicly returns scopes with one-hour caching', async () => {
		const readScopes = sandbox.stub(getProbeLogScopesStorage(), 'readScopes').resolves([ 'system', 'worker' ]);

		const response = await requestAgent.get('/v1/probes/log-scopes')
			.send()
			.expect(200);

		expect(response.headers['cache-control']).to.equal('public, max-age=3600, stale-while-revalidate=3600, stale-if-error=86400');
		expect(response.body).to.deep.equal([ 'system', 'worker' ]);
		expect(readScopes.calledOnceWithExactly()).to.equal(true);
	});
});
