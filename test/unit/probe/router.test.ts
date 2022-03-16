import * as sinon from 'sinon';
import {Server} from 'socket.io';
import {expect} from 'chai';
import {ProbeRouter} from '../../../src/probe/router.js';
import {PROBES_NAMESPACE} from '../../../src/lib/ws/server.js';

describe('probe router', () => {
	const sandbox = sinon.createSandbox();

	const wsServerMock = sandbox.createStubInstance(Server);
	const sampleFnMock = (items: any[], size: number): any[] => items.slice(0, size);
	const router = new ProbeRouter(wsServerMock, sampleFnMock as any);

	beforeEach(() => {
		sandbox.reset();
	});

	describe('route with location limit', () => {
		it('should find probes for each location', async () => {
			const sockets = [
				{id: 'socket-1', data: {probe: {location: {continent: 'EU', country: 'UA'}}}},
				{id: 'socket-2', data: {probe: {location: {continent: 'EU', country: 'PL'}}}},
				{id: 'socket-3', data: {probe: {location: {continent: 'EU', country: 'PL'}}}},
				{id: 'socket-4', data: {probe: {location: {continent: 'NA', country: 'UA'}}}},
				{id: 'socket-5', data: {probe: {location: {continent: 'EU', country: 'PL'}}}},
			];

			wsServerMock.of.returnsThis();
			wsServerMock.fetchSockets.resolves(sockets as any);

			const probes = await router.findMatchingProbes([
				{type: 'country', value: 'UA', limit: 2},
				{type: 'country', value: 'PL', limit: 2},
			]);

			expect(wsServerMock.of.calledOnce).to.be.true;
			expect(wsServerMock.of.firstCall.firstArg).to.equal(PROBES_NAMESPACE);

			expect(probes.length).to.equal(4);
			expect(probes.filter(p => p.location.country === 'UA').length).to.equal(2);
			expect(probes.filter(p => p.location.country === 'PL').length).to.equal(2);
		});
	});

	describe.skip('route with global limit', () => {
		// TODO: add tests
	});
});
