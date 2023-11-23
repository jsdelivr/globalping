import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

describe('ws server', () => {
	let initWsServer: () => any, getWsServer: () => any;

	const redisClient = {
		duplicate: () => redisClient,
		connect: sinon.stub(),
	};
	const disconnect = sinon.stub();
	const fetchSocketsSocketIo = sinon.stub();
	const getRedisClient = sinon.stub().returns(redisClient);
	const io = {
		adapter: sinon.stub(),
		of: sinon.stub().returns({
			fetchSockets: fetchSocketsSocketIo,
		}),
	};

	before(async () => {
		await td.replaceEsm('socket.io', { Server: sinon.stub().returns(io) });
		await td.replaceEsm('../../../../src/lib/redis/client.ts', { getRedisClient });
	});

	beforeEach(async () => {
		({ initWsServer, getWsServer } = await import('../../../../src/lib/ws/server.js'));
		fetchSocketsSocketIo.reset();
		fetchSocketsSocketIo.resolves([{ disconnect }, {	disconnect }]);
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
