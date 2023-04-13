import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

describe('ws server', () => {
	let sandbox: sinon.SinonSandbox;
	let initWsServer, getWsServer, fetchSockets;

	const redisClient = {
		duplicate: () => redisClient,
		connect: sinon.stub(),
	};
	const disconnect = sinon.stub();
	const fetchSocketsSocketIo = sinon.stub();
	const getRedisClient = sinon.stub().returns(redisClient);
	const of = sinon.stub().returns({
		fetchSockets: fetchSocketsSocketIo,
	});
	const io = {
		adapter: sinon.stub(),
		of,
	};

	before(async () => {
		await td.replaceEsm('socket.io', { Server: sinon.stub().returns(io) });
		await td.replaceEsm('../../../../src/lib/redis/client.ts', { getRedisClient });
	});

	beforeEach(async () => {
		({ initWsServer, getWsServer, fetchSockets } = await import('../../../../src/lib/ws/server.js'));
		sandbox = sinon.createSandbox({ useFakeTimers: true });
		fetchSocketsSocketIo.reset();
		fetchSocketsSocketIo.resolves([{ disconnect }, {	disconnect }]);
	});

	afterEach(() => {
		sandbox.restore();
	});

	after(() => {
		td.reset();
	});

	it('initWsServer should reconnect the probes on start', async () => {
		await initWsServer();
		await sandbox.clock.tickAsync(8000 + 60_000 + 1000);

		expect(io.adapter.callCount).to.equal(1);
		expect(redisClient.connect.callCount).to.equal(2);
		expect(disconnect.callCount).to.equal(2);
	});

	it('getWsServer should return the same instance every time', async () => {
		await initWsServer();
		const wsServer1 = getWsServer();
		const wsServer2 = getWsServer();
		const wsServer3 = getWsServer();
		expect(wsServer1).to.equal(wsServer2);
		expect(wsServer1).to.equal(wsServer3);
	});

	it('multiple calls to fetchSockets should result in one socket.io fetchSockets call', async () => {
		await initWsServer();
		await sandbox.clock.tickAsync(8000 + 60_000 + 1000);
		fetchSocketsSocketIo.reset();
		fetchSocketsSocketIo.resolves([]);

		await Promise.all([
			fetchSockets(),
			fetchSockets(),
			fetchSockets(),
		]);

		expect(fetchSocketsSocketIo.callCount).to.equal(1);
	});
});
