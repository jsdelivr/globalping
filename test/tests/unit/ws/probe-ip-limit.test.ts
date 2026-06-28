import * as sinon from 'sinon';
import { expect } from 'chai';

import { ProbeIpLimit, getIpKey } from '../../../../src/lib/ws/helper/probe-ip-limit.js';

describe('ProbeIpLimit', () => {
	const sandbox = sinon.createSandbox();
	const fetchProbes = sandbox.stub();
	const disconnectBySocketId = sandbox.stub();
	const getByIp = sandbox.stub();
	const getByUuid = sandbox.stub();
	const getUserIdByToken = sandbox.stub();
	const adoptedProbes = { getByIp, getByUuid } as any;
	const adoptionToken = { getUserIdByToken } as any;
	const createProbeIpLimit = () => new ProbeIpLimit(fetchProbes, disconnectBySocketId, adoptedProbes, adoptionToken);

	beforeEach(() => {
		getByIp.returns(null);
		getByUuid.returns(null);
		getUserIdByToken.returnsArg(0);
	});

	afterEach(() => {
		sandbox.resetHistory();
	});

	const getProbe = (client: string, ipAddress: string, {
		altIpAddresses = [] as string[],
		adoptionToken = null as string | null,
		owner = null as { id: string } | null,
		asn = 1,
		city = 'Paris',
	} = {}) => ({ client, ipAddress, altIpAddresses, adoptionToken, owner, location: { asn, city } });

	describe('getIpKey', () => {
		it('returns IPv4 unchanged', () => {
			expect(getIpKey('1.1.1.1')).to.equal('1.1.1.1');
		});

		it('collapses IPv6 to its /64 prefix', () => {
			expect(getIpKey('2001:db8:1:2:3:4:5:6')).to.equal('2001:db8:1:2::/64');
			expect(getIpKey('2001:db8:1:2:ffff:ffff:ffff:ffff')).to.equal('2001:db8:1:2::/64');
		});

		it('keeps different /64 prefixes separate', () => {
			expect(getIpKey('2001:db8:1:2::1')).to.not.equal(getIpKey('2001:db8:1:3::1'));
		});

		it('maps IPv4-mapped IPv6 to its IPv4 form', () => {
			expect(getIpKey('::ffff:1.2.3.4')).to.equal('1.2.3.4');
		});
	});

	describe('syncIpLimit (one probe per IPv4 or IPv6/64)', () => {
		it('should disconnect duplicates', async () => {
			fetchProbes.resolves([ getProbe('a', '1.1.1.1'), getProbe('b', '2.2.2.2'), getProbe('c', '2.2.2.2') ]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledOnceWithExactly('c')).to.equal(true);
		});

		it('should disconnect the primary-IP holder when another probe holds the same IP as an alt', async () => {
			fetchProbes.resolves([ getProbe('a', '1.1.1.1'), getProbe('b', '2.2.2.2'), getProbe('c', '3.3.3.3', { altIpAddresses: [ '2.2.2.2' ] }) ]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledOnceWithExactly('b')).to.equal(true);
		});

		it('should disconnect duplicates across alt ips', async () => {
			fetchProbes.resolves([ getProbe('a', '1.1.1.1'), getProbe('b', '2.2.2.2', { altIpAddresses: [ '4.4.4.4' ] }), getProbe('c', '3.3.3.3', { altIpAddresses: [ '4.4.4.4' ] }) ]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledOnceWithExactly('c')).to.equal(true);
		});

		it('should preserve socket with the earliest id', async () => {
			fetchProbes.resolves([ getProbe('a', '1.1.1.1'), getProbe('c', '2.2.2.2'), getProbe('b', '2.2.2.2'), getProbe('d', '2.2.2.2') ]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledTwice).to.equal(true);
			expect(disconnectBySocketId.firstCall.args[0]).to.equal('c');
			expect(disconnectBySocketId.secondCall.args[0]).to.equal('d');
		});

		it('should disconnect a probe sharing the /64 of another (IPv6)', async () => {
			fetchProbes.resolves([ getProbe('a', '2001:db8:0:1::1'), getProbe('b', '2001:db8:0:1::ffff') ]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledOnceWithExactly('b')).to.equal(true);
		});

		it('should keep probes in different /64s', async () => {
			fetchProbes.resolves([ getProbe('a', '2001:db8:0:1::1'), getProbe('b', '2001:db8:0:2::1') ]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.called).to.equal(false);
		});

		it('should keep probes whose alt IPs share a /64 (no primary in the range)', async () => {
			fetchProbes.resolves([
				getProbe('a', '1.1.1.1', { altIpAddresses: [ '2001:db8:0:1::1' ] }),
				getProbe('b', '2.2.2.2', { altIpAddresses: [ '2001:db8:0:1::2' ] }),
			]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.called).to.equal(false);
		});

		it('should disconnect the primary-IP holder when another probe holds an alt IP in the same /64', async () => {
			fetchProbes.resolves([
				getProbe('a', '2001:db8:0:1::1'),
				getProbe('b', '2.2.2.2', { altIpAddresses: [ '2001:db8:0:1::2' ] }),
			]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledOnceWithExactly('a')).to.equal(true);
		});
	});

	describe('syncIpLimit (max 2 per user + asn + city)', () => {
		it('should disconnect probes beyond the limit, keeping the earliest ids', async () => {
			fetchProbes.resolves([
				getProbe('a', '2001:db8:0:1::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
				getProbe('b', '2001:db8:0:2::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
				getProbe('c', '2001:db8:0:3::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
			]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledOnceWithExactly('c')).to.equal(true);
		});

		it('should not count probes in a different asn or city', async () => {
			fetchProbes.resolves([
				getProbe('a', '2001:db8:0:1::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
				getProbe('b', '2001:db8:0:2::1', { adoptionToken: 'token', asn: 200, city: 'Paris' }),
				getProbe('c', '2001:db8:0:3::1', { adoptionToken: 'token', asn: 100, city: 'Berlin' }),
			]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.called).to.equal(false);
		});

		it('should not count probes of a different (or missing) adoption token', async () => {
			fetchProbes.resolves([
				getProbe('a', '2001:db8:0:1::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
				getProbe('b', '2001:db8:0:2::1', { adoptionToken: 'other', asn: 100, city: 'Paris' }),
				getProbe('c', '2001:db8:0:3::1', { asn: 100, city: 'Paris' }),
			]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.called).to.equal(false);
		});

		it('should group probes of the same owner regardless of the adoption token', async () => {
			fetchProbes.resolves([
				getProbe('a', '2001:db8:0:1::1', { owner: { id: 'user1' }, adoptionToken: 'token', asn: 100, city: 'Paris' }),
				getProbe('b', '2001:db8:0:2::1', { owner: { id: 'user1' }, asn: 100, city: 'Paris' }),
				getProbe('c', '2001:db8:0:3::1', { owner: { id: 'user1' }, asn: 100, city: 'Paris' }),
			]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledOnceWithExactly('c')).to.equal(true);
		});

		it('should not count probes of a different owner', async () => {
			fetchProbes.resolves([
				getProbe('a', '2001:db8:0:1::1', { owner: { id: 'user1' }, asn: 100, city: 'Paris' }),
				getProbe('b', '2001:db8:0:2::1', { owner: { id: 'user1' }, asn: 100, city: 'Paris' }),
				getProbe('c', '2001:db8:0:3::1', { owner: { id: 'user2' }, asn: 100, city: 'Paris' }),
			]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.called).to.equal(false);
		});

		it('should not double-disconnect a probe already removed by the IP limit', async () => {
			fetchProbes.resolves([
				getProbe('a', '2001:db8:0:1::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
				getProbe('b', '2001:db8:0:2::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
				getProbe('c', '2001:db8:0:1::2', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
			]);

			const probeIpLimit = createProbeIpLimit();
			await probeIpLimit.syncIpLimit();

			expect(disconnectBySocketId.calledOnceWithExactly('c')).to.equal(true);
		});
	});

	describe('connection-time checks', () => {
		const originalTestMode = process.env['TEST_MODE'];

		before(() => {
			delete process.env['TEST_MODE'];
		});

		after(() => {
			process.env['TEST_MODE'] = originalTestMode;
		});

		const catchError = async (promise: Promise<void>) => {
			try {
				await promise;
				return null;
			} catch (error) {
				return error as Error;
			}
		};

		describe('verifyIpLimit (ip + /64 range)', () => {
			it('throws "ip limit" when another probe shares the same /64', async () => {
				fetchProbes.resolves([ getProbe('a', '2001:db8:0:1::1') ]);

				const probeIpLimit = createProbeIpLimit();
				const error = await catchError(probeIpLimit.verifyIpLimit('2001:db8:0:1::abcd', 'new'));

				expect(error?.message).to.equal('ip limit');
			});

			it('does not throw when the other probe is in a different /64', async () => {
				fetchProbes.resolves([ getProbe('a', '2001:db8:0:1::1') ]);

				const probeIpLimit = createProbeIpLimit();
				const error = await catchError(probeIpLimit.verifyIpLimit('2001:db8:0:2::1', 'new'));

				expect(error).to.equal(null);
			});

			it('shares one in-flight probe fetch across concurrent connects', async () => {
				let resolveFetch: (probes: unknown[]) => void = () => {};
				fetchProbes.returns(new Promise((resolve) => {
					resolveFetch = resolve;
				}));

				const probeIpLimit = createProbeIpLimit();
				const first = catchError(probeIpLimit.verifyIpLimit('2001:db8:0:1::1', 'x'));
				const second = catchError(probeIpLimit.verifyIpLimit('2001:db8:0:2::1', 'y'));

				resolveFetch([ getProbe('a', '2001:db8:0:9::1') ]);

				expect(await Promise.all([ first, second ])).to.deep.equal([ null, null ]);
				expect(fetchProbes.callCount).to.equal(1);
			});
		});

		describe('verifyAsnLimit (asn + city)', () => {
			const verify = (probeIpLimit: ProbeIpLimit, probe: ReturnType<typeof getProbe>) => catchError(probeIpLimit.verifyAsnLimit(probe as any));

			it('throws "asn limit" when the token already has the limit of unique /64s in the asn+city', async () => {
				fetchProbes.resolves([
					getProbe('a', '2001:db8:0:1::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
					getProbe('b', '2001:db8:0:2::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
				]);

				const probeIpLimit = createProbeIpLimit();
				const error = await verify(probeIpLimit, getProbe('new', '2001:db8:0:3::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }));

				expect(error?.message).to.equal('asn limit');
			});

			it('counts unique /64s, not socket count, within the asn+city', async () => {
				fetchProbes.resolves([
					getProbe('x', '2001:db8:0:1::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
					getProbe('y', '2001:db8:0:1::2', { adoptionToken: 'token', asn: 100, city: 'Paris' }),
				]);

				const probeIpLimit = createProbeIpLimit();
				const error = await verify(probeIpLimit, getProbe('new', '2001:db8:0:2::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }));

				expect(error).to.equal(null);
			});

			it('throws "asn limit" for a code-adopted probe without a token when the owner already has the limit of unique /64s', async () => {
				getByIp.returns({ userId: 'user1' });

				fetchProbes.resolves([
					getProbe('a', '2001:db8:0:1::1', { owner: { id: 'user1' }, asn: 100, city: 'Paris' }),
					getProbe('b', '2001:db8:0:2::1', { owner: { id: 'user1' }, asn: 100, city: 'Paris' }),
				]);

				const error = await verify(createProbeIpLimit(), getProbe('new', '2001:db8:0:3::1', { asn: 100, city: 'Paris' }));

				expect(error?.message).to.equal('asn limit');
			});

			it('counts code-adopted probes of the same user when connecting with a token', async () => {
				getUserIdByToken.withArgs('token').returns('user1');

				fetchProbes.resolves([
					getProbe('a', '2001:db8:0:1::1', { owner: { id: 'user1' }, asn: 100, city: 'Paris' }),
					getProbe('b', '2001:db8:0:2::1', { owner: { id: 'user1' }, asn: 100, city: 'Paris' }),
				]);

				const error = await verify(createProbeIpLimit(), getProbe('new', '2001:db8:0:3::1', { adoptionToken: 'token', asn: 100, city: 'Paris' }));

				expect(error?.message).to.equal('asn limit');
			});

			it('does not count probes of a different owner', async () => {
				getByIp.returns({ userId: 'user1' });

				fetchProbes.resolves([
					getProbe('a', '2001:db8:0:1::1', { owner: { id: 'user2' }, asn: 100, city: 'Paris' }),
					getProbe('b', '2001:db8:0:2::1', { owner: { id: 'user2' }, asn: 100, city: 'Paris' }),
				]);

				const error = await verify(createProbeIpLimit(), getProbe('new', '2001:db8:0:3::1', { asn: 100, city: 'Paris' }));

				expect(error).to.equal(null);
			});

			it('does not apply the asn limit to tokenless non-adopted probes', async () => {
				fetchProbes.resolves([
					getProbe('a', '2001:db8:0:1::1', { asn: 100, city: 'Paris' }),
					getProbe('b', '2001:db8:0:2::1', { asn: 100, city: 'Paris' }),
				]);

				const probeIpLimit = createProbeIpLimit();
				const error = await verify(probeIpLimit, getProbe('new', '2001:db8:0:3::1', { asn: 100, city: 'Paris' }));

				expect(error).to.equal(null);
			});
		});
	});
});
