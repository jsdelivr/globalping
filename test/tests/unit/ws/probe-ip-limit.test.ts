import * as sinon from 'sinon';
import { expect } from 'chai';

import { ProbeIpLimit } from '../../../../src/lib/ws/helper/probe-ip-limit.js';

describe('ProbeIpLimit', () => {
	const sandbox = sinon.createSandbox();
	const fetchProbes = sandbox.stub();
	const fetchRawSockets = sandbox.stub();

	const getSocket = (id: string, ip: string) => ({
		id,
		data: { probe: { ipAddress: ip } },
		disconnect: sandbox.stub(),
	});

	it('syncIpLimit should disconnect duplicates', async () => {
		const socket1 = getSocket('a', '1.1.1.1');
		const socket2 = getSocket('b', '2.2.2.2');
		const duplicate = getSocket('c', '2.2.2.2');

		fetchRawSockets.resolves([
			socket1,
			socket2,
			duplicate,
		]);

		const probeIpLimit = new ProbeIpLimit(fetchProbes, fetchRawSockets);
		await probeIpLimit.syncIpLimit();

		expect(socket1.disconnect.callCount).to.equal(0);
		expect(socket2.disconnect.callCount).to.equal(0);
		expect(duplicate.disconnect.callCount).to.equal(1);
	});

	it('syncIpLimit should preserve socket with the earliest id', async () => {
		const socket1 = getSocket('a', '1.1.1.1');
		const socket2 = getSocket('b', '2.2.2.2');
		const duplicate1 = getSocket('c', '2.2.2.2');
		const duplicate2 = getSocket('d', '2.2.2.2');

		fetchRawSockets.resolves([
			socket1,
			duplicate1,
			socket2,
			duplicate2,
		]);

		const probeIpLimit = new ProbeIpLimit(fetchProbes, fetchRawSockets);
		await probeIpLimit.syncIpLimit();

		expect(socket1.disconnect.callCount).to.equal(0);
		expect(socket2.disconnect.callCount).to.equal(0);
		expect(duplicate1.disconnect.callCount).to.equal(1);
		expect(duplicate2.disconnect.callCount).to.equal(1);
	});
});
