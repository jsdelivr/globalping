import nock from 'nock';
import * as sinon from 'sinon';
import { setTimeout } from 'node:timers/promises';
import { getTestServer, addFakeProbe, deleteFakeProbes } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { expect } from 'chai';
import { client } from '../../../src/lib/sql/client.js';
import { adoptionToken } from '../../../src/adoption/adoption-token.js';
import { randomUUID } from 'crypto';

describe('Adoption token', () => {
	const sandbox = sinon.createSandbox();

	const adoptionStatusStub = sandbox.stub();

	before(async () => {
		await getTestServer();
		await client('directus_users').insert({ id: 'userIdValue', adoption_token: 'adoptionTokenValue', default_prefix: 'defaultPrefixValue' });
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

		nock('https://dash-directus.globalping.io').put('/adoption-code/adopt-by-token', (body) => {
			expect(body).to.deep.equal({
				probe: {
					userId: null,
					ip: '1.2.3.4',
					name: null,
					altIps: [],
					uuid: '1-1-1-1-1',
					tags: [],
					systemTags: [ 'datacenter-network' ],
					status: 'initializing',
					isIPv4Supported: false,
					isIPv6Supported: false,
					version: '0.39.0',
					nodeVersion: 'v18.17.0',
					hardwareDevice: null,
					hardwareDeviceFirmware: null,
					city: 'Dallas',
					state: 'TX',
					stateName: 'Texas',
					country: 'US',
					countryName: 'United States',
					continent: 'NA',
					continentName: 'North America',
					region: 'Northern America',
					latitude: 32.78,
					longitude: -96.81,
					asn: 20004,
					network: 'The Constant Company LLC',
					adoptionToken: 'adoptionTokenValue',
					customLocation: null,
					originalLocation: null,
					allowedCountries: [ 'US' ],
				},
				user: { id: 'userIdValue' },
			});

			return true;
		}).reply(200);

		await addFakeProbe({ 'api:connect:adoption': adoptionStatusStub }, { query: { adoptionToken: 'adoptionTokenValue' } });

		await setTimeout(100);
		expect(adoptionStatusStub.callCount).to.equal(1);
		expect(adoptionStatusStub.args[0]).to.deep.equal([{ message: 'Probe successfully adopted by token.' }]);
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

		await addFakeProbe({ 'api:connect:adoption': adoptionStatusStub }, { query: { adoptionToken: 'adoptionTokenValue' } });

		await setTimeout(100);
		expect(adoptionStatusStub.callCount).to.equal(0);
	});
});
