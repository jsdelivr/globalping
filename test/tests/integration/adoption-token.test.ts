import nock from 'nock';
import * as sinon from 'sinon';
import { setTimeout } from 'node:timers/promises';
import { getTestServer, addFakeProbe, deleteFakeProbes, getIoContext } from '../../utils/server.js';
import nockGeoIpProviders from '../../utils/nock-geo-ip.js';
import { expect } from 'chai';
import { dashboardClient } from '../../../src/lib/sql/client.js';
import { createOrg, createUser } from '../../utils/fixtures.js';
import { randomUUID } from 'crypto';

describe('Adoption token', () => {
	const sandbox = sinon.createSandbox();

	const adoptionStatusStub = sandbox.stub();

	let user: { id: string; accountId: string };
	let org: { id: string; accountId: string };

	before(async () => {
		await getTestServer();

		user = await createUser(dashboardClient, { id: 'userIdValue', accountId: 'accountIdValue', adoption_token: 'adoptionTokenValue' });

		org = await createOrg(dashboardClient, {
			adoption_token: 'orgAdoptionToken',
			extra_adoption_tokens: JSON.stringify([{ github_username: 'someone', token: 'handedOverToken' }]),
		});

		await getIoContext().adoptionToken.syncTokens();
	});

	afterEach(async () => {
		sandbox.resetHistory();
		await deleteFakeProbes();
		await dashboardClient('gp_probes').delete();
		await dashboardClient('directus_notifications').delete();
	});

	after(async () => {
		nock.cleanAll();
		await deleteFakeProbes();
		await dashboardClient('gp_accounts').whereIn('id', [ user.accountId, org.accountId ]).delete();
		await dashboardClient('gp_orgs').where({ id: org.id }).delete();
		await dashboardClient('directus_users').where({ id: user.id }).delete();
	});

	const adoptWithToken = async (adoptionToken: string) => {
		nockGeoIpProviders();

		let adoptedForAccount: string | undefined;

		nock('https://dash-directus.globalping.io').put('/adoption-code/adopt-by-token', (body) => {
			adoptedForAccount = (body as { account: { id: string } }).account.id;
			return true;
		}).reply(200);

		await addFakeProbe({ 'api:connect:adoption': adoptionStatusStub }, { query: { adoptionToken } });
		await setTimeout(100);

		return adoptedForAccount;
	};

	it('should adopt probe by token', async () => {
		nockGeoIpProviders();

		nock('https://dash-directus.globalping.io').put('/adoption-code/adopt-by-token', (body) => {
			expect(body).to.deep.equal({
				probe: {
					accountId: null,
					ip: '1.2.3.4',
					name: null,
					altIps: [],
					uuid: '11111111-1111-4111-8111-111111111111',
					tags: [],
					systemTags: [ 'datacenter-network' ],
					status: 'initializing',
					isIPv4Supported: false,
					isIPv6Supported: false,
					version: '0.50.0',
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
					network: 'The Constant Company',
					customLocation: null,
					originalLocation: null,
					allowedCountries: [ 'US' ],
					localAdoptionServer: null,
				},
				account: { id: 'accountIdValue' },
			});

			return true;
		}).reply(200);

		await addFakeProbe({ 'api:connect:adoption': adoptionStatusStub }, { query: { adoptionToken: 'adoptionTokenValue' } });

		await setTimeout(100);
		expect(adoptionStatusStub.callCount).to.equal(1);
		expect(adoptionStatusStub.args[0]).to.deep.equal([{ message: 'Probe successfully adopted by token.', adopted: true }]);
	});

	it('should do nothing if it is the same user', async () => {
		await dashboardClient('gp_probes').insert({
			id: randomUUID(),
			uuid: '11111111-1111-4111-8111-111111111111',
			ip: '1.2.3.4',
			account_id: 'accountIdValue',
			status: 'offline',
			version: '0.39.0',
			nodeVersion: 'v18.17.0',
			lastSyncDate: new Date(),
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
			network: 'The Constant Company',
			allowedCountries: JSON.stringify([ 'US' ]),
		});

		nockGeoIpProviders();

		await addFakeProbe({ 'api:connect:adoption': adoptionStatusStub }, { query: { adoptionToken: 'adoptionTokenValue' } });

		await setTimeout(100);
		expect(adoptionStatusStub.callCount).to.equal(0);
	});

	it('should adopt probe by the org token', async () => {
		expect(await adoptWithToken('orgAdoptionToken')).to.equal(org.accountId);
		expect(adoptionStatusStub.args[0]).to.deep.equal([{ message: 'Probe successfully adopted by token.', adopted: true }]);
	});

	it('should adopt probe by a token handed over to the org', async () => {
		expect(await adoptWithToken('handedOverToken')).to.equal(org.accountId);
	});

	it('should warn about an unknown token', async () => {
		nockGeoIpProviders();

		await addFakeProbe({ 'api:connect:adoption': adoptionStatusStub }, { query: { adoptionToken: 'notATokenAtAll' } });
		await setTimeout(100);

		expect(adoptionStatusStub.args[0]).to.deep.equal([{
			message: 'User not found for the provided adoption token: notATokenAtAll.',
			level: 'warn',
			adopted: false,
		}]);
	});
});
