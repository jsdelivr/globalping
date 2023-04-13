import * as sinon from 'sinon';
import { Server } from 'socket.io';
import { expect } from 'chai';
import * as td from 'testdouble';
import type { RedisClient } from '../../../../src/lib/redis/client.js';
import { MeasurementStore } from '../../../../src/measurement/store.js';
import { ProbeRouter } from '../../../../src/probe/router.js';
import { MetricsAgent } from '../../../../src/lib/metrics.js';
import { Probe } from '../../../../src/probe/types.js';

const getProbe = id => ({ client: id } as Probe);

describe('MeasurementRunner', () => {
	const emit = sinon.stub();
	const to = sinon.stub();
	const io = sinon.createStubInstance(Server);
	const redis = {} as RedisClient;
	const store = sinon.createStubInstance(MeasurementStore);
	const router = sinon.createStubInstance(ProbeRouter);
	const metrics = sinon.createStubInstance(MetricsAgent);
	let runner;
	let testId;

	before(async () => {
		td.replaceEsm('crypto-random-string', null, () => testId++);
		const { MeasurementRunner } = await import('../../../../src/measurement/runner.js');
		runner = new MeasurementRunner(io, redis, store, router, metrics);
	});

	beforeEach(() => {
		emit.reset();
		to.reset();
		to.returns({ emit });
		io.of.returns({ to } as any);
		router.findMatchingProbes.reset();
		store.createMeasurement.reset();
		store.createMeasurement.resolves('measurementid');
		metrics.recordMeasurement.reset();
		testId = 0;
	});

	it('should run measurement for the required amount of probes', async () => {
		router.findMatchingProbes.resolves([ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ]);

		await runner.run({
			type: 'ping',
			target: 'jsdelivr.com',
			measurementOptions: {
				packets: 3,
			},
			locations: [],
			limit: 10,
			inProgressUpdates: false,
		});


		expect(router.findMatchingProbes.callCount).to.equal(1);
		expect(router.findMatchingProbes.args[0]).to.deep.equal([ [], 10 ]);
		expect(store.createMeasurement.callCount).to.equal(1);

		expect(store.createMeasurement.args[0]).to.deep.equal([ 'ping', [{ client: 0 }, { client: 1 }, { client: 2 }, { client: 3 }] ]);

		expect(to.callCount).to.equal(4);
		expect(emit.callCount).to.equal(4);
		expect(to.args[0][0]).to.equal(0);

		expect(emit.args[0]).to.deep.equal([ 'probe:measurement:request', {
			measurement: {
				inProgressUpdates: false,
				packets: 3,
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '0',
		}]);

		expect(to.args[1][0]).to.equal(1);

		expect(emit.args[1]).to.deep.equal([ 'probe:measurement:request', {
			measurement: {
				inProgressUpdates: false,
				packets: 3,
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '1',
		}]);

		expect(to.args[2][0]).to.equal(2);

		expect(emit.args[2]).to.deep.equal([ 'probe:measurement:request', {
			measurement: {
				inProgressUpdates: false,
				packets: 3,
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '2',
		}]);

		expect(to.args[3][0]).to.equal(3);

		expect(emit.args[3]).to.deep.equal([ 'probe:measurement:request', {
			measurement: {
				inProgressUpdates: false,
				packets: 3,
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '3',
		}]);

		expect(metrics.recordMeasurement.callCount).to.equal(1);
		expect(metrics.recordMeasurement.args[0]).to.deep.equal([ 'ping' ]);
	});

	it('should send `inProgressUpdates: true` to the first N probes if requested', async () => {
		router.findMatchingProbes.resolves([ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ]);

		await runner.run({
			type: 'ping',
			target: 'jsdelivr.com',
			measurementOptions: {
				packets: 3,
			},
			locations: [],
			limit: 10,
			inProgressUpdates: true,
		});


		expect(router.findMatchingProbes.callCount).to.equal(1);
		expect(router.findMatchingProbes.args[0]).to.deep.equal([ [], 10 ]);
		expect(store.createMeasurement.callCount).to.equal(1);

		expect(store.createMeasurement.args[0]).to.deep.equal([ 'ping', [{ client: 0 }, { client: 1 }, { client: 2 }, { client: 3 }] ]);

		expect(to.callCount).to.equal(4);
		expect(emit.callCount).to.equal(4);

		expect(emit.args[0]).to.deep.equal([ 'probe:measurement:request', {
			measurement: {
				inProgressUpdates: true,
				packets: 3,
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '0',
		}]);

		expect(emit.args[1]).to.deep.equal([ 'probe:measurement:request', {
			measurement: {
				inProgressUpdates: true,
				packets: 3,
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '1',
		}]);

		expect(emit.args[2]).to.deep.equal([ 'probe:measurement:request', {
			measurement: {
				inProgressUpdates: false,
				packets: 3,
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '2',
		}]);

		expect(emit.args[3]).to.deep.equal([ 'probe:measurement:request', {
			measurement: {
				inProgressUpdates: false,
				packets: 3,
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '3',
		}]);

		expect(metrics.recordMeasurement.callCount).to.equal(1);
		expect(metrics.recordMeasurement.args[0]).to.deep.equal([ 'ping' ]);
	});
});
