import type { Server } from 'node:http';
import nock from 'nock';
import { expect } from 'chai';
import * as sinon from 'sinon';
import request, { type Agent } from 'supertest';
import { getTestServer, addFakeProbe, deleteFakeProbes } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';

describe('Adoption code', () => {
	let app: Server;
	let requestAgent: Agent;
	const adoptionCodeStub = sinon.stub();

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
		nockGeoIpProviders();

		await addFakeProbe({
			'probe:adoption:code': adoptionCodeStub,
		});
	});

	afterEach(async () => {
		sinon.resetHistory();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
	});

	it('should send code to the requested probe', async () => {
		await requestAgent.post('/v1/adoption-code?systemkey=system')
			.send({
				ip: '1.2.3.4',
				code: '123456',
			})
			.expect(200).expect((response) => {
				expect(response.body).to.deep.equal({
					uuid: '1-1-1-1-1',
					version: '0.14.0',
					isHardware: false,
					hardwareDevice: null,
					status: 'initializing',
					city: 'Dallas',
					state: 'TX',
					country: 'US',
					latitude: 32.7831,
					longitude: -96.8067,
					asn: 20004,
					network: 'The Constant Company LLC',
				});
			});

		expect(adoptionCodeStub.callCount).to.equal(1);
		expect(adoptionCodeStub.args[0]).to.deep.equal([{ code: '123456' }]);
	});

	it('should return 403 for wrong system key', async () => {
		await requestAgent.post('/v1/adoption-code?systemkey=wrongkey')
			.send({
				ip: '1.2.3.4',
				code: '123456',
			})
			.expect(403).expect((response) => {
				expect(response.body.error.message).to.equal('Forbidden');
			});

		expect(adoptionCodeStub.callCount).to.equal(0);
	});

	it('should return 422 if probe not found', async () => {
		await requestAgent.post('/v1/adoption-code?systemkey=system')
			.send({
				ip: '9.9.9.9',
				code: '123456',
			})
			.expect(422).expect((response) => {
				expect(response.body.error.message).to.equal('No suitable probes found.');
			});

		expect(adoptionCodeStub.callCount).to.equal(0);
	});
});
