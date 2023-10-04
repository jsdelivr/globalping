import nock from 'nock';
import { expect } from 'chai';
import * as sinon from 'sinon';
import type { Socket } from 'socket.io-client';
import request from 'supertest';
import { getTestServer, addFakeProbe, deleteFakeProbe } from '../../../utils/server.js';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';

let probe: Socket;
const app = await getTestServer();
const requestAgent = request(app);
const adoptionCodeStub = sinon.stub();

describe('Adoption code', () => {
	before(async () => {
		nockGeoIpProviders();

		probe = await addFakeProbe({
			'probe:adoption:code': adoptionCodeStub,
		});
	});

	afterEach(async () => {
		sinon.resetHistory();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbe(probe);
	});

	it('should send code to the requested probe', async () => {
		await requestAgent.post('/v1/adoption-code?adminkey=admin')
			.send({
				ip: '1.2.3.4',
				code: '123456',
			})
			.expect(200).expect((response) => {
				expect(response.body).to.deep.equal({
					result: 'Code was sent to the probe',
				});
			});

		expect(adoptionCodeStub.callCount).to.equal(1);
		expect(adoptionCodeStub.args[0]).to.deep.equal([{ code: '123456' }]);
	});

	it('should return 403 for non-admins', async () => {
		await requestAgent.post('/v1/adoption-code?adminkey=wrongkey')
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
		await requestAgent.post('/v1/adoption-code?adminkey=admin')
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
