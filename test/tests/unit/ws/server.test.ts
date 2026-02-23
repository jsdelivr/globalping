import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

describe('ws server', () => {
	let initWsServer: (probeOverride: any) => Promise<{ io: any; syncedProbeList: any }>;

	const sandbox = sinon.createSandbox();
	const redisClient = {
		duplicate: () => redisClient,
		connect: sandbox.stub(),
		xAdd: sandbox.stub().resolves(null),
		xRange: sandbox.stub().resolves([]),
		pExpire: sandbox.stub().resolves(null),
		json: {
			get: sandbox.stub().resolves(null),
			set: sandbox.stub().resolves(null),
		},
	};
	const disconnect = sandbox.stub();
	const fetchSocketsSocketIo = sandbox.stub();
	const getRedisClient = sandbox.stub().returns(redisClient);
	const io = {
		adapter: sandbox.stub(),
		of: sandbox.stub().returns({
			on: sandbox.stub(),
			serverSideEmit: sandbox.stub(),
			local: {
				fetchSockets: fetchSocketsSocketIo,
			},
		}),
	};

	before(async () => {
		await td.replaceEsm('socket.io', { Server: sandbox.stub().returns(io) });
		await td.replaceEsm('../../../../src/lib/redis/client.ts', { getRedisClient });
	});

	beforeEach(async () => {
		({ initWsServer } = await import('../../../../src/lib/ws/server.js'));
		fetchSocketsSocketIo.reset();

		fetchSocketsSocketIo.resolves([
			{ data: { probe: { ipAddress: '1.2.3.4', altIpAddresses: [] } }, disconnect },
			{ data: { probe: { ipAddress: '1.2.3.4', altIpAddresses: [] } }, disconnect },
		]);
	});

	it('initWsServer should return io and syncedProbeList', async () => {
		const probeOverride = {
			getUpdatedLocation: sandbox.stub(),
			addAdminData: sandbox.stub().returnsArg(0),
			addAdoptedData: sandbox.stub().returnsArg(0),
		};

		const result = await initWsServer(probeOverride);
		expect(result).to.have.property('io');
		expect(result).to.have.property('syncedProbeList');
		expect(result.io).to.equal(io);
	});
});
