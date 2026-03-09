import * as sinon from 'sinon';
import { expect } from 'chai';

import { ProbeIpLimit } from '../../../../src/lib/ws/helper/probe-ip-limit.js';

describe('ProbeIpLimit', () => {
	const sandbox = sinon.createSandbox();
	const fetchProbes = sandbox.stub();
	const disconnectBySocketId = sandbox.stub();
	const getProbeByIp = sandbox.stub();

	afterEach(() => {
		sandbox.resetHistory();
	});

	const getSocket = (id: string, ip: string, altIpAddresses: string[] = []) => ({
		id,
		data: { probe: { client: id, ipAddress: ip, altIpAddresses } },
		disconnect: sandbox.stub(),
	});

	it('syncIpLimit should disconnect duplicates', async () => {
		const socket1 = getSocket('a', '1.1.1.1');
		const socket2 = getSocket('b', '2.2.2.2');
		const duplicate = getSocket('c', '2.2.2.2');

		fetchProbes.resolves([
			socket1.data.probe,
			socket2.data.probe,
			duplicate.data.probe,
		]);

		const probeIpLimit = new ProbeIpLimit(fetchProbes, disconnectBySocketId, getProbeByIp);
		await probeIpLimit.syncIpLimit();

		expect(disconnectBySocketId.calledOnceWithExactly('c')).to.equal(true);
	});

	it('syncIpLimit should disconnect duplicates with alt ip', async () => {
		const socket1 = getSocket('a', '1.1.1.1');
		const socket2 = getSocket('b', '2.2.2.2');
		const duplicate = getSocket('c', '3.3.3.3', [ '2.2.2.2' ]);

		fetchProbes.resolves([
			socket1.data.probe,
			socket2.data.probe,
			duplicate.data.probe,
		]);

		const probeIpLimit = new ProbeIpLimit(fetchProbes, disconnectBySocketId, getProbeByIp);
		await probeIpLimit.syncIpLimit();

		expect(disconnectBySocketId.calledOnceWithExactly('c')).to.equal(true);
	});

	it('syncIpLimit should disconnect duplicates across alt ips', async () => {
		const socket1 = getSocket('a', '1.1.1.1');
		const socket2 = getSocket('b', '2.2.2.2', [ '4.4.4.4' ]);
		const duplicate = getSocket('c', '3.3.3.3', [ '4.4.4.4' ]);

		fetchProbes.resolves([
			socket1.data.probe,
			socket2.data.probe,
			duplicate.data.probe,
		]);

		const probeIpLimit = new ProbeIpLimit(fetchProbes, disconnectBySocketId, getProbeByIp);
		await probeIpLimit.syncIpLimit();

		expect(disconnectBySocketId.calledOnceWithExactly('c')).to.equal(true);
	});

	it('syncIpLimit should preserve socket with the earliest id', async () => {
		const socket1 = getSocket('a', '1.1.1.1');
		const socket2 = getSocket('b', '2.2.2.2');
		const duplicate1 = getSocket('c', '2.2.2.2');
		const duplicate2 = getSocket('d', '2.2.2.2');

		fetchProbes.resolves([
			socket1.data.probe,
			duplicate1.data.probe,
			socket2.data.probe,
			duplicate2.data.probe,
		]);

		const probeIpLimit = new ProbeIpLimit(fetchProbes, disconnectBySocketId, getProbeByIp);
		await probeIpLimit.syncIpLimit();

		expect(disconnectBySocketId.calledTwice).to.equal(true);
		expect(disconnectBySocketId.firstCall.args[0]).to.equal('c');
		expect(disconnectBySocketId.secondCall.args[0]).to.equal('d');
	});
});
