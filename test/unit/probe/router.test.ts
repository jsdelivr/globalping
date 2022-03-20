import * as sinon from 'sinon';
import _ from 'lodash';
import {expect} from 'chai';
import {RemoteSocket, Server} from 'socket.io';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events.js';
import {ProbeRouter} from '../../../src/probe/router.js';
import {PROBES_NAMESPACE, SocketData} from '../../../src/lib/ws/server.js';
import type {DeepPartial} from '../../types.js';
import type {ProbeLocation} from '../../../src/probe/types.js';

type Socket = RemoteSocket<DefaultEventsMap, SocketData>;

describe('probe router', () => {
	const sandbox = sinon.createSandbox();
	const wsServerMock = sandbox.createStubInstance(Server);
	// Const sampleFnMock = (items: any[], size: number): any[] => items.slice(0, size);
	const router = new ProbeRouter(wsServerMock, _.sampleSize);

	beforeEach(() => {
		sandbox.reset();

		wsServerMock.of.returnsThis();
	});

	describe('route with location limit', () => {
		it('should find probes for each location', async () => {
			const sockets: Array<DeepPartial<Socket>> = [
				{id: 'socket-1', data: {probe: {location: {continent: 'EU', country: 'UA'}}}},
				{id: 'socket-2', data: {probe: {location: {continent: 'EU', country: 'PL'}}}},
				{id: 'socket-3', data: {probe: {location: {continent: 'EU', country: 'PL'}}}},
				{id: 'socket-4', data: {probe: {location: {continent: 'NA', country: 'UA'}}}},
				{id: 'socket-5', data: {probe: {location: {continent: 'EU', country: 'PL'}}}},
			];

			wsServerMock.fetchSockets.resolves(sockets as never);

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

	describe('route globally distributed', () => {
		type Socket = RemoteSocket<DefaultEventsMap, SocketData>;

		const distribution = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			AF: 5, AS: 15, EU: 30, OC: 10, NA: 30, SA: 10,
		};

		const buildSocket = (id: string, location: Partial<ProbeLocation>): DeepPartial<Socket> => ({
			id,
			data: {probe: {location}},
		});

		it('should find probes when each group is full', async () => {
			const sockets = Object.keys(distribution)
				.flatMap(continent => _.range(50).map(i => buildSocket(`${continent}-${i}`, {continent})));

			wsServerMock.fetchSockets.resolves(sockets as never);

			const probes = await router.findMatchingProbes([], 100);
			const grouped = _.groupBy(probes, 'location.continent');

			expect(probes.length).to.equal(100);
			expect(grouped['AF']?.length).to.equal(5);
			expect(grouped['AS']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(30);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(30);
			expect(grouped['SA']?.length).to.equal(10);
		});

		it('should find probes when some groups are not full', async () => {
			const sockets: DeepPartial<Socket[]> = [
				...(_.range(15).map(i => buildSocket(`AF-${i}`, {continent: 'AF'}))),
				...(_.range(15).map(i => buildSocket(`AS-${i}`, {continent: 'AS'}))),
				...(_.range(20).map(i => buildSocket(`EU-${i}`, {continent: 'EU'}))),
				...(_.range(10).map(i => buildSocket(`OC-${i}`, {continent: 'OC'}))),
				...(_.range(20).map(i => buildSocket(`NA-${i}`, {continent: 'NA'}))),
				...(_.range(30).map(i => buildSocket(`SA-${i}`, {continent: 'SA'}))),
			];

			wsServerMock.fetchSockets.resolves(sockets as never);

			const probes = await router.findMatchingProbes([], 100);
			const grouped = _.groupBy(probes, 'location.continent');

			expect(probes.length).to.equal(100);
			expect(grouped['AF']?.length).to.equal(13);
			expect(grouped['AS']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(20);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(20);
			expect(grouped['SA']?.length).to.equal(22);
		});

		it('should find when probes not enough', async () => {
			const sockets: DeepPartial<Socket[]> = [
				...(_.range(15).map(i => buildSocket(`AF-${i}`, {continent: 'AF'}))),
				...(_.range(20).map(i => buildSocket(`EU-${i}`, {continent: 'EU'}))),
				...(_.range(10).map(i => buildSocket(`OC-${i}`, {continent: 'OC'}))),
				...(_.range(20).map(i => buildSocket(`NA-${i}`, {continent: 'NA'}))),
			];

			wsServerMock.fetchSockets.resolves(sockets as never);

			const probes = await router.findMatchingProbes([], 100);
			const grouped = _.groupBy(probes, 'location.continent');

			expect(probes.length).to.equal(65);
			expect(grouped['AF']?.length).to.equal(15);
			expect(grouped['EU']?.length).to.equal(20);
			expect(grouped['OC']?.length).to.equal(10);
			expect(grouped['NA']?.length).to.equal(20);
		});
	});

	describe.skip('route with global limit', () => {
		// TODO: add tests
	});
});
