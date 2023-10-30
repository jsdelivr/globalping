import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

const fetchRawSockets = sinon.stub();
const getAdoptedIpToProbe = sinon.stub();

describe('fetchSockets', () => {
	let fetchSockets;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/ws/server.ts', { fetchRawSockets });
		await td.replaceEsm('../../../../src/lib/adopted-probes.ts', { adoptedProbes: { getAdoptedIpToProbe } });
		({ fetchSockets } = await import('../../../../src/lib/ws/fetch-sockets.js'));
	});

	beforeEach(() => {
		sinon.resetHistory();
	});

	after(() => {
		td.reset();
	});

	it('should apply adopted probes data to the result sockets', async () => {
		fetchRawSockets.resolves([{
			data: {
				probe: {
					client: 'pf2pER5jLnhxTgBqAAAB',
					version: '0.26.0',
					nodeVersion: 'v18.17.0',
					uuid: 'c873cd81-5ede-4fff-9314-5905ad2bdb58',
					ipAddress: '1.1.1.1',
					host: '',
					location: {
						continent: 'EU',
						region: 'Western Europe',
						normalizedRegion: 'western europe',
						country: 'FR',
						state: undefined,
						city: 'Paris',
						normalizedCity: 'paris',
						asn: 12876,
						latitude: 48.8534,
						longitude: 2.3488,
						network: 'SCALEWAY S.A.S.',
						normalizedNetwork: 'scaleway s.a.s.',
					},
					index: [
						[ 'fr' ],
						[ 'fra' ],
						[ 'france' ],
						[],
						[ 'paris' ],
						[],
						[],
						[ 'eu' ],
						[ 'eu', 'europe' ],
						[ 'western europe' ],
						[ 'western europe', 'west europe' ],
						[ 'as12876' ],
						[ 'datacenter network' ],
						[ 'scaleway s.a.s.' ],
						[],
					],
					resolvers: [ 'private' ],
					tags: [{ type: 'system', value: 'datacenter-network' }],
					stats: { cpu: { count: 8, load: [] }, jobs: { count: 0 } },
					status: 'ready',
				},
			},
		}]);

		getAdoptedIpToProbe.returns(new Map([ [ '1.1.1.1', {
			ip: '1.1.1.1',
			uuid: 'c873cd81-5ede-4fff-9314-5905ad2bdb58',
			lastSyncDate: '2023-10-29T21:00:00.000Z',
			isCustomCity: 1,
			tags: [ 'user-tag' ],
			status: 'ready',
			version: '0.26.0',
			asn: 12876,
			network: 'SCALEWAY S.A.S.',
			country: 'FR',
			city: 'Marseille',
			latitude: 43.29695,
			longitude: 5.38107,
		}] ]));

		const result = await fetchSockets();
		expect(result).to.deep.equal([
			{
				data: {
					probe: {
						client: 'pf2pER5jLnhxTgBqAAAB',
						version: '0.26.0',
						nodeVersion: 'v18.17.0',
						uuid: 'c873cd81-5ede-4fff-9314-5905ad2bdb58',
						ipAddress: '1.1.1.1',
						host: '',
						location: {
							continent: 'EU',
							region: 'Western Europe',
							normalizedRegion: 'western europe',
							country: 'FR',
							state: undefined,
							city: 'Marseille',
							normalizedCity: 'paris',
							asn: 12876,
							latitude: 43.29695,
							longitude: 5.38107,
							network: 'SCALEWAY S.A.S.',
							normalizedNetwork: 'scaleway s.a.s.',
						},
						index: [
							[ 'fr' ],
							[ 'fra' ],
							[ 'france' ],
							[],
							[ 'marseille' ],
							[],
							[],
							[ 'eu' ],
							[ 'eu', 'europe' ],
							[ 'western europe' ],
							[ 'western europe', 'west europe' ],
							[ 'as12876' ],
							[ 'datacenter network', 'user tag' ],
							[ 'scaleway s.a.s.' ],
							[],
						],
						resolvers: [ 'private' ],
						tags: [{ type: 'system', value: 'datacenter-network' }, { type: 'user', value: 'u-baderfall-user-tag' }],
						stats: { cpu: { count: 8, load: [] }, jobs: { count: 0 } },
						status: 'ready',
					},
				},
			},
		]);
	});

	it('multiple calls to fetchSockets should result in one socket.io fetchSockets call', async () => {
		expect(fetchRawSockets.callCount).to.equal(0);

		await Promise.all([
			fetchSockets(),
			fetchSockets(),
			fetchSockets(),
		]);

		expect(fetchRawSockets.callCount).to.equal(1);
	});
});
