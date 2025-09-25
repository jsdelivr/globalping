import sinon from 'sinon';
import { expect } from 'chai';
import { AltIpsClient } from '../../../src/lib/alt-ips-client.js';
import type { Probe } from '../../../src/probe/types.js';

describe('AltIpsClient', () => {
	const sandbox = sinon.createSandbox();

	let probe: Probe;
	let redis: any;
	let geoIpClient: any;
	let altIps: AltIpsClient;

	beforeEach(() => {
		probe = {
			client: 'socketId1',
			ipAddress: '1.1.1.1',
			altIpAddresses: [],
			location: {
				country: 'IT',
				allowedCountries: [ 'IT', 'FR' ],
			},
		} as unknown as Probe;


		redis = {
			hSet: sandbox.stub().resolves(),
			hExpire: sandbox.stub().resolves(),
			hmGet: sandbox.stub(),
		};

		geoIpClient = {
			lookup: sandbox.stub().resolves({ country: 'IT', isAnycast: false }),
		};

		altIps = new AltIpsClient(redis, geoIpClient);
	});

	afterEach(async () => {
		sandbox.reset();
	});

	it('should generate token and store it in redis', async () => {
		const token = await altIps.generateToken('2.2.2.2');

		expect(token).to.be.a('string');
		expect(redis.hSet.calledOnce).to.be.true;
		expect(redis.hExpire.calledOnce).to.be.true;
		expect(redis.hSet.args[0]).to.deep.equal([ 'gp:alt-ip-tokens', token, '2.2.2.2' ]);
		expect(redis.hExpire.args[0]).to.deep.equal([ 'gp:alt-ip-tokens', token, 60 ]);
	});

	it('should add alt ip with valid token', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '2.2.2.2' ]);

		const result = await altIps.addAltIps(probe, [ [ '2.2.2.2', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([ '2.2.2.2' ]);
		expect(redis.hmGet.args[0]).to.deep.equal([ 'gp:alt-ip-tokens', [ token ] ]);
		expect(result.addedAltIps).to.deep.equal([ '2.2.2.2' ]);
		expect(result.rejectedIpsToResons).to.deep.equal({});
	});

	it('should reject alt ip with invalid token', async () => {
		const token = 'invalidToken';
		redis.hmGet.resolves([ null ]);

		const result = await altIps.addAltIps(probe, [ [ '2.2.2.2', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([]);
		expect(result.addedAltIps).to.deep.equal([]);
		expect(result.rejectedIpsToResons).to.deep.equal({ '2.2.2.2': 'Invalid alt IP token.' });
	});

	it('should reject alt ip with token for different ip', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '2.2.2.2' ]);

		const result = await altIps.addAltIps(probe, [ [ '3.3.3.3', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([]);
		expect(result.addedAltIps).to.deep.equal([]);
		expect(result.rejectedIpsToResons).to.deep.equal({ '3.3.3.3': 'Invalid alt IP token.' });
	});

	it('should reject alt ip that matches probe ip', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '1.1.1.1' ]);

		const result = await altIps.addAltIps(probe, [ [ '1.1.1.1', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([]);
		expect(result.addedAltIps).to.deep.equal([]);
		expect(result.rejectedIpsToResons).to.deep.equal({ '1.1.1.1': 'Alt IP is the same as the probe IP.' });
	});

	it('should reject private alt ip', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '192.168.1.1' ]);

		const result = await altIps.addAltIps(probe, [ [ '192.168.1.1', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([]);
		expect(result.addedAltIps).to.deep.equal([]);
		expect(result.rejectedIpsToResons).to.deep.equal({ '192.168.1.1': 'Alt IP is private.' });
	});

	it('should reject blocked alt ip', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '172.224.226.1' ]);

		const result = await altIps.addAltIps(probe, [ [ '172.224.226.1', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([]);
		expect(result.addedAltIps).to.deep.equal([]);
		expect(result.rejectedIpsToResons).to.deep.equal({ '172.224.226.1': 'Alt IP is blocked.' });
	});

	it('should reject alt ip from different country', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '2.2.2.2' ]);
		geoIpClient.lookup.resolves({ country: 'DE', isAnycast: false });

		const result = await altIps.addAltIps(probe, [ [ '2.2.2.2', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([]);
		expect(result.addedAltIps).to.deep.equal([]);
		expect(result.rejectedIpsToResons).to.deep.equal({ '2.2.2.2': 'Alt IP country doesn\'t match the probe country.' });
	});

	it('should accept alt ip from allowed country', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '2.2.2.2' ]);
		geoIpClient.lookup.resolves({ country: 'FR', isAnycast: false });

		const result = await altIps.addAltIps(probe, [ [ '2.2.2.2', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([ '2.2.2.2' ]);
		expect(result.addedAltIps).to.deep.equal([ '2.2.2.2' ]);
		expect(result.rejectedIpsToResons).to.deep.equal({});
	});

	it('should reject anycast alt ip', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '2.2.2.2' ]);
		geoIpClient.lookup.resolves({ country: 'IT', isAnycast: true });

		const result = await altIps.addAltIps(probe, [ [ '2.2.2.2', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([]);
		expect(result.addedAltIps).to.deep.equal([]);
		expect(result.rejectedIpsToResons).to.deep.equal({ '2.2.2.2': 'Alt IP is anycast.' });
	});

	it('should handle geoip lookup error', async () => {
		const token = 'validToken';
		redis.hmGet.resolves([ '2.2.2.2' ]);
		geoIpClient.lookup.rejects(new Error('geoip error'));

		const result = await altIps.addAltIps(probe, [ [ '2.2.2.2', token ] ]);

		expect(probe.altIpAddresses).to.deep.equal([]);
		expect(result.addedAltIps).to.deep.equal([]);
		expect(result.rejectedIpsToResons).to.deep.equal({ '2.2.2.2': 'Failed to add an alt IP.' });
	});

	it('should handle multiple alt ips with mixed validity', async () => {
		const tokens: [string, string][] = [ [ '2.2.2.2', 'validToken1' ], [ '3.3.3.3', 'validToken2' ], [ '4.4.4.4', 'invalidToken' ] ];
		redis.hmGet.resolves([ '2.2.2.2', '3.3.3.3', null ]);
		geoIpClient.lookup.onCall(0).resolves({ country: 'IT', isAnycast: false });
		geoIpClient.lookup.onCall(1).resolves({ country: 'DE', isAnycast: false });

		const result = await altIps.addAltIps(probe, tokens);

		expect(probe.altIpAddresses).to.deep.equal([ '2.2.2.2' ]);
		expect(result.addedAltIps).to.deep.equal([ '2.2.2.2' ]);

		expect(result.rejectedIpsToResons).to.deep.equal({
			'4.4.4.4': 'Invalid alt IP token.',
			'3.3.3.3': 'Alt IP country doesn\'t match the probe country.',
		});
	});
});
