import {Socket} from 'socket.io';
import * as sinon from 'sinon';

import {getWsServer, PROBES_NAMESPACE} from '../../../../src/lib/ws/server.js';
import {createServer} from '../../../../src/lib/server.js';

describe.only('server', function () {
	this.timeout(15_000);

	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox({useFakeTimers: true});
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('should force probes to reconnect on start', async () => {
		await createServer();
		const namespace = getWsServer().of(PROBES_NAMESPACE);
		const fakeSocket = sinon.createStubInstance(Socket);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		namespace.fetchSockets = async () => ([fakeSocket]);

		sinon.assert.notCalled(fakeSocket.disconnect);

		sandbox.clock.tick(10_000);
		await sandbox.clock.tickAsync(62_000);

		sinon.assert.calledOnce(fakeSocket.disconnect);
	});
});
