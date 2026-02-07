import * as sinon from 'sinon';
import * as td from 'testdouble';
import { expect } from 'chai';

const sandbox = sinon.createSandbox();
const disconnect = sandbox.stub();
const fetchRawSockets = sandbox.stub().resolves([{ disconnect }, {	disconnect }]);

describe('reconnectProbes', () => {
	let reconnectProbes: (delay: number) => void;

	before(async () => {
		await td.replaceEsm('../../../../src/lib/ws/server.ts', {
			fetchRawSockets,
		});

		({ reconnectProbes } = await import('../../../../src/lib/ws/helper/reconnect-probes.js'));
	});

	afterEach(() => {
		sandbox.restore();
	});

	after(() => {
		td.reset();
	});

	it('should disconnect every probe in configured time', async () => {
		reconnectProbes(2 * 60 * 1000);

		expect(fetchRawSockets.callCount).to.equal(0);
		expect(disconnect.callCount).to.equal(0);

		await clock.tickAsync(8000 + 2 * 60_000 + 1000);

		expect(fetchRawSockets.callCount).to.equal(1);
		expect(disconnect.callCount).to.equal(2);
	});
});
