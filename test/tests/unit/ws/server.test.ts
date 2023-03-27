import { Socket } from 'socket.io';
import * as sinon from 'sinon';

import { getWsServer, PROBES_NAMESPACE } from '../../../../src/lib/ws/server.js';
import { createServer } from '../../../../src/lib/server.js';

describe('server', function () {
	this.timeout(15_000);

	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox({ useFakeTimers: true });
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('should force probes to reconnect on start', async () => {
		await createServer();
		const namespace = getWsServer().of(PROBES_NAMESPACE);
		const fakeSocket1 = sinon.createStubInstance(Socket);
		const fakeSocket2 = sinon.createStubInstance(Socket);
		const fakeSocket3 = sinon.createStubInstance(Socket);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		namespace.fetchSockets = async () => [ fakeSocket1, fakeSocket2, fakeSocket3 ];

		sinon.assert.notCalled(fakeSocket1.disconnect);
		sinon.assert.notCalled(fakeSocket2.disconnect);
		sinon.assert.notCalled(fakeSocket3.disconnect);

		sandbox.clock.tick(10_000);
		await sandbox.clock.tickAsync(62_000);

		sinon.assert.calledOnce(fakeSocket1.disconnect);
		sinon.assert.calledOnce(fakeSocket2.disconnect);
		sinon.assert.calledOnce(fakeSocket3.disconnect);
	});
});
