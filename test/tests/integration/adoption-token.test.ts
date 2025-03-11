import nock from 'nock';
import * as sinon from 'sinon';
import { getTestServer, addFakeProbe, deleteFakeProbes, waitForProbesUpdate } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { expect } from 'chai';
import { client } from '../../../src/lib/sql/client.js';
import { adoptionToken } from '../../../src/adoption/adoption-token.js';
import { randomUUID } from 'crypto';

describe('Adoption token', () => {
	const sandbox = sinon.createSandbox();

	before(async () => {
		await getTestServer();
		await client('directus_users').insert({ id: 'userIdValue', adoption_token: 'adoptionTokenValue' });
		await adoptionToken.syncTokens();
	});

	afterEach(async () => {
		sandbox.resetHistory();
		await deleteFakeProbes();
		await client('gp_probes').delete();
		await client('directus_notifications').delete();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
		await client('directus_users').delete();
	});

	it('should adopt probe by token', async () => {
		nockGeoIpProviders();
		const probe = await addFakeProbe();
		probe.emit('probe:adoption:token', 'adoptionTokenValue');
		await waitForProbesUpdate();

		const dProbe = await client('gp_probes').first();
		expect(dProbe).to.include({
			userId: 'userIdValue',
		});

		const notification = await client('directus_notifications').first();
		expect(notification).to.include({
			recipient: 'userIdValue',
			subject: 'New probe adopted',
		});
	});

	it('should reassign probe by token', async () => {
		await client('gp_probes').insert({
			id: randomUUID(),
			uuid: '1-1-1-1-1',
			ip: '1.2.3.4',
			userId: 'prevUserIdValue',
			lastSyncDate: new Date(),
			status: 'offline',
		});

		nockGeoIpProviders();
		const probe = await addFakeProbe();
		probe.emit('probe:adoption:token', 'adoptionTokenValue');
		await waitForProbesUpdate();

		const dProbe = await client('gp_probes').first();
		expect(dProbe).to.include({
			userId: 'userIdValue',
		});

		const notifications = await client('directus_notifications').select();

		expect(notifications[0]).to.include({
			recipient: 'userIdValue',
			subject: 'New probe adopted',
		});

		expect(notifications[1]).to.include({
			recipient: 'prevUserIdValue',
			subject: 'Probe was unassigned',
		});
	});

	it('should do nothing if it is the same user', async () => {
		await client('gp_probes').insert({
			id: randomUUID(),
			uuid: '1-1-1-1-1',
			ip: '1.2.3.4',
			userId: 'userIdValue',
			lastSyncDate: new Date(),
			status: 'offline',
		});

		nockGeoIpProviders();
		const probe = await addFakeProbe();
		probe.emit('probe:adoption:token', 'adoptionTokenValue');
		await waitForProbesUpdate();

		const dProbe = await client('gp_probes').first();
		expect(dProbe).to.include({
			userId: 'userIdValue',
		});

		const notifications = await client('directus_notifications').select();
		expect(notifications.length).to.equal(0);
	});
});
