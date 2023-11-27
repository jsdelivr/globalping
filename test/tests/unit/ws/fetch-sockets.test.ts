import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

import type { LRUOptions } from '../../../../src/lib/ws/helper/throttle.js';
import type { RemoteProbeSocket } from '../../../../src/lib/ws/server.js';
import type { Probe } from '../../../../src/probe/types.js';

const fetchRawSockets = sinon.stub().resolves([]);
const getByIp = sinon.stub();
const getUpdatedLocation = sinon.stub();
const getUpdatedTags = sinon.stub();

describe('fetchSockets', () => {
	let fetchSockets: (options?: LRUOptions) => Promise<RemoteProbeSocket[]>;

	beforeEach(async () => {
		sinon.resetHistory();
		td.reset();
		await td.replaceEsm('../../../../src/lib/ws/server.ts', { fetchRawSockets });
		await td.replaceEsm('../../../../src/lib/adopted-probes.ts', { adoptedProbes: { getByIp, getUpdatedLocation, getUpdatedTags } });
		({ fetchSockets } = await import('../../../../src/lib/ws/fetch-sockets.js'));
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
					isHardware: false,
					hardwareDevice: null,
					resolvers: [ 'private' ],
					tags: [{ type: 'system', value: 'datacenter-network' }],
					stats: { cpu: { count: 8, load: [] }, jobs: { count: 0 } },
					status: 'ready',
				} as Probe,
			},
		}]);

		getByIp.returns({
			username: 'jimaek',
			ip: '1.1.1.1',
			uuid: 'c873cd81-5ede-4fff-9314-5905ad2bdb58',
			lastSyncDate: '2023-10-29T21:00:00.000Z',
			isCustomCity: 1,
			tags: [ 'my-tag-1' ],
			status: 'ready',
			version: '0.26.0',
			asn: 12876,
			network: 'SCALEWAY S.A.S.',
			country: 'FR',
			city: 'Marseille',
			latitude: 43.29695,
			longitude: 5.38107,
		});

		getUpdatedLocation.returns({
			continent: 'EU',
			region: 'Western Europe',
			country: 'FR',
			state: undefined,
			city: 'Marseille',
			normalizedCity: 'marseille',
			asn: 12876,
			latitude: 43.29695,
			longitude: 5.38107,
			network: 'SCALEWAY S.A.S.',
			normalizedNetwork: 'scaleway s.a.s.',
		});

		getUpdatedTags.returns([{ type: 'system', value: 'datacenter-network' }, { type: 'user', value: 'u-jimaek-my-tag-1' }]);

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
							country: 'FR',
							state: undefined,
							city: 'Marseille',
							normalizedCity: 'marseille',
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
							[ 'datacenter network' ],
							[ 'scaleway s.a.s.' ],
							[],
						],
						isHardware: false,
						hardwareDevice: null,
						resolvers: [ 'private' ],
						tags: [{ type: 'system', value: 'datacenter-network' }, { type: 'user', value: 'u-jimaek-my-tag-1' }],
						stats: { cpu: { count: 8, load: [] }, jobs: { count: 0 } },
						status: 'ready',
					} as Probe,
				},
			},
		]);
	});

	it('should return same socket object if there is no adoption data or it is not edited', async () => {
		const socket1 = { id: '1', data: { probe: { ipAddress: '' } } };
		const socket2 = { id: '2', data: { probe: { ipAddress: '' } } };
		fetchRawSockets.resolves([ socket1, socket2 ]);
		getByIp.onCall(0).returns(undefined);
		getByIp.onCall(1).returns({ isCustomCity: false, tags: [] });
		const result = await fetchSockets();
		expect(result[0]).to.equal(socket1);
		expect(result[1]).to.equal(socket2);
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
