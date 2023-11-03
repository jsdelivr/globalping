import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

const disconnect = sinon.stub();
const fetchSockets = sinon.stub().resolves([{ disconnect }, {	disconnect }]);

describe('reconnectProbes', () => {
	let sandbox: sinon.SinonSandbox;
	let reconnectProbes: () => void;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/ws/fetch-sockets.ts', {
			fetchSockets,
		});

		({ reconnectProbes } = await import('../../../../src/lib/ws/helper/reconnect-probes.js'));
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox({ useFakeTimers: true });
	});

	afterEach(() => {
		sandbox.restore();
	});

	after(() => {
		td.reset();
	});

	it('should disconnect every probe in configured time', async () => {
		reconnectProbes();

		expect(fetchSockets.callCount).to.equal(0);
		expect(disconnect.callCount).to.equal(0);

		await sandbox.clock.tickAsync(8000 + 2 * 60_000 + 1000);

		expect(fetchSockets.callCount).to.equal(1);
		expect(disconnect.callCount).to.equal(2);
	});
});
