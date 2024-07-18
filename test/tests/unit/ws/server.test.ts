import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

describe('ws server', () => {
	let initWsServer: () => any, getWsServer: () => any;

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
		({ initWsServer, getWsServer } = await import('../../../../src/lib/ws/server.js'));
		fetchSocketsSocketIo.reset();
		fetchSocketsSocketIo.resolves([{ data: { probe: { altIpAddresses: [] } }, disconnect }, { data: { probe: { altIpAddresses: [] } }, disconnect }]);
	});

	it('getWsServer should return the same instance every time', async () => {
		await initWsServer();
		const wsServer1 = getWsServer();
		const wsServer2 = getWsServer();
		const wsServer3 = getWsServer();
		expect(wsServer1).to.equal(wsServer2);
		expect(wsServer1).to.equal(wsServer3);
	});
});
