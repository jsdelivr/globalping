import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

const fetchRawSockets = sinon.stub();

describe('fetchSockets', () => {
	let fetchSockets;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/ws/server.ts', {
			fetchRawSockets,
		});

		({ fetchSockets } = await import('../../../../src/lib/ws/fetch-sockets.js'));
	});

	after(() => {
		td.reset();
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
