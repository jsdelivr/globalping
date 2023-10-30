import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

const fetchConnectedSockets = sinon.stub();

describe('fetchSockets', () => {
	let fetchSockets;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/ws/server.ts', {
			fetchConnectedSockets,
		});

		({ fetchSockets } = await import('../../../../src/lib/ws/fetch-sockets.js'));
	});

	after(() => {
		td.reset();
	});

	it('multiple calls to fetchSockets should result in one socket.io fetchSockets call', async () => {
		expect(fetchConnectedSockets.callCount).to.equal(0);

		await Promise.all([
			fetchSockets(),
			fetchSockets(),
			fetchSockets(),
		]);

		expect(fetchConnectedSockets.callCount).to.equal(1);
	});
});
