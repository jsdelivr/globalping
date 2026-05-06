import * as sinon from 'sinon';
import { expect } from 'chai';
import { reconnectProbes } from '../../../../src/lib/ws/helper/reconnect-probes.js';

const sandbox = sinon.createSandbox();
const disconnect = sandbox.stub();
const fetchRawSockets = sandbox.stub().resolves([{ disconnect }, {	disconnect }]);

describe('reconnectProbes', () => {
	afterEach(() => {
		sandbox.restore();
	});

	it('should disconnect every probe in configured time', async () => {
		reconnectProbes(fetchRawSockets as any, 2 * 60 * 1000);

		expect(fetchRawSockets.callCount).to.equal(0);
		expect(disconnect.callCount).to.equal(0);

		await clock.tickAsync(8000 + 2 * 60_000 + 1000);

		expect(fetchRawSockets.callCount).to.equal(1);
		expect(disconnect.callCount).to.equal(2);
	});
});
