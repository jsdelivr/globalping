import {
	type GetProbeLogsResponse,
	waitForLogSync,
	waitProbeInCity,
	waitProbeToDisconnect,
} from '../utils.js';
import got from 'got';
import { client } from '../../../src/lib/sql/client.js';
import { expect } from 'chai';
import config from 'config';
import { AuthenticateOptions } from '../../../src/lib/http/middleware/authenticate.js';
import { JWTPayload, SignJWT } from 'jose';
import { docker } from '../docker.js';
import _ from 'lodash';

const sessionConfig = config.get<AuthenticateOptions['session']>('server.session');

describe('probe logs', () => {
	let sessionKey: Buffer;
	const USER_ID = '89da69bd-a236-4ab7-9c5d-b5f52ce11111';
	const PROBE_ID = '89da69bd-a236-4ab7-9c5d-b5f52ce09959';

	const getSignedJwt = (options: JWTPayload) => {
		return new SignJWT(options).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(sessionKey);
	};

	before(async () => {
		sessionKey = Buffer.from(sessionConfig.cookieSecret);
		await client('directus_users').delete();
		await client('gp_probes').delete();

		await client('directus_users').insert({
			id: USER_ID,
			adoption_token: 'adoptionTokenValue',
			github_username: 'jimaek',
			github_organizations: JSON.stringify([ 'jsdelivr' ]),
			default_prefix: 'jsdelivr',
			public_probes: true,
		});

		await client('gp_probes').insert({
			id: PROBE_ID,
			userId: USER_ID,
			lastSyncDate: new Date(),
			ip: '1.2.3.4',
			uuid: '1-1-1-1-1',
			tags: '[{"prefix":"jimaek","value":"dashboardtag1"}]',
			status: 'ready',
			isIPv4Supported: true,
			isIPv6Supported: true,
			version: '0.39.0',
			nodeVersion: 'v18.14.2',
			country: 'AR',
			countryName: 'Argentina',
			city: 'San Luis',
			continent: 'SA',
			continentName: 'South America',
			region: 'South America',
			latitude: -33.3,
			longitude: -66.34,
			network: 'InterBS S.R.L. (BAEHOST)',
			asn: 61003,
			allowedCountries: '["AR"]',
			customLocation: JSON.stringify({
				country: 'AR',
				city: 'San Luis',
				latitude: -33.3,
				longitude: -66.34,
				state: null,
			}),
		});

		await waitProbeInCity('San Luis');
	});

	after(async function () {
		this.timeout(80000);
		await client('gp_probes').delete();
		await client('directus_users').delete();
	});

	it('should return logs in the expected format', async () => {
		const jwt = await getSignedJwt({ id: USER_ID, app_access: true });
		const authCookie = `${sessionConfig.cookieName}=${jwt}`;
		const response = await waitForLogSync(PROBE_ID, authCookie);

		expect(response.body.lastId).to.exist;
		expect(response.body.lastId).to.be.a('string');
		expect(response.body.logs).to.be.an('array');

		const logCount = response.body.logs.length;

		expect(logCount).to.be.at.least(1);
		expect(response.body.logs[logCount - 1]).to.have.property('timestamp');
		expect(response.body.logs[logCount - 1]).to.have.property('scope');
		expect(response.body.logs[logCount - 1]).to.have.property('message');
		expect(response.body.logs[logCount - 1]).to.have.property('level');
	});

	it('should respect the after parameter', async () => {
		const jwt = await getSignedJwt({ id: USER_ID, app_access: true });
		const authCookie = `${sessionConfig.cookieName}=${jwt}`;

		const initialResponse = await waitForLogSync(PROBE_ID, authCookie);

		expect(initialResponse.body.lastId).to.exist;
		expect(initialResponse.body.lastId).to.be.a('string');

		const lastId = initialResponse.body.lastId;

		const newResponse = await got<GetProbeLogsResponse>(
			`http://localhost:80/v1/probes/${PROBE_ID}/logs?after=${lastId}`,
			{
				responseType: 'json',
				throwHttpErrors: false,
				headers: { Cookie: authCookie },
			},
		);

		expect(newResponse.statusCode).to.equal(200);
		expect(newResponse.body.lastId).to.be.null;
		expect(newResponse.body.logs).to.be.an('array');
		expect(newResponse.body.logs.length).to.equal(0);
	});

	it('should sync logs and respect the after parameter after probe restarts', async () => {
		const jwt = await getSignedJwt({ id: 'admin-id', app_access: true, admin_access: true });
		const authCookie = `${sessionConfig.cookieName}=${jwt}`;

		const response = await waitForLogSync(PROBE_ID, authCookie);

		expect(response.body.lastId).to.exist;
		expect(response.body.lastId).to.be.a('string');

		const initialTimestamps = response.body.logs.map(log => log.timestamp);
		const lastId = response.body.lastId;

		await docker.stopProbeContainer();
		await waitProbeToDisconnect();
		await docker.startProbeContainer();

		const newResponse = await waitForLogSync(PROBE_ID, authCookie, lastId as string);

		expect(newResponse.body.lastId).to.exist;
		expect(newResponse.body.lastId).to.not.equal(lastId);

		const newTimestamps = newResponse.body.logs.map(log => log.timestamp);
		expect(_.intersection(initialTimestamps, newTimestamps).length).to.equal(0);
	});

	it('should return logs when probe is offline', async () => {
		const jwt = await getSignedJwt({ id: USER_ID, app_access: true });
		const authCookie = `${sessionConfig.cookieName}=${jwt}`;

		const initialResponse = await waitForLogSync(PROBE_ID, authCookie);

		await docker.stopProbeContainer();
		await waitProbeToDisconnect();

		const newResponse = await got<GetProbeLogsResponse>(
			`http://localhost:80/v1/probes/${PROBE_ID}/logs`,
			{
				responseType: 'json',
				throwHttpErrors: false,
				headers: { Cookie: authCookie },
			},
		);

		expect(initialResponse.body).to.deep.equal(newResponse.body);
	});
});
