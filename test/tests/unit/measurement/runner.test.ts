import type { Context } from 'koa';
import * as sinon from 'sinon';
import { Server } from 'socket.io';
import { expect } from 'chai';
import * as td from 'testdouble';
import { MeasurementStore } from '../../../../src/measurement/store.js';
import { ProbeRouter } from '../../../../src/probe/router.js';
import { MetricsAgent } from '../../../../src/lib/metrics.js';
import type { Probe } from '../../../../src/probe/types.js';
import type { MeasurementRunner } from '../../../../src/measurement/runner.js';
import type { MeasurementRecord, MeasurementResultMessage } from '../../../../src/measurement/types.js';

const getProbe = (id: number) => ({ client: id } as unknown as Probe);

const req = {
	headers: {
		'x-client-ip': '1.1.1.1',
	},
};

describe('MeasurementRunner', () => {
	const set = sinon.stub();
	const emit = sinon.stub();
	const to = sinon.stub();
	const io = sinon.createStubInstance(Server);
	const store = sinon.createStubInstance(MeasurementStore);
	const router = sinon.createStubInstance(ProbeRouter);
	const metrics = sinon.createStubInstance(MetricsAgent);
	let runner: MeasurementRunner;
	let testId: number;

	before(async () => {
		td.replaceEsm('crypto-random-string', null, () => testId++);
		const { MeasurementRunner } = await import('../../../../src/measurement/runner.js');
		runner = new MeasurementRunner(io, store, router, metrics);
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
		router.findMatchingProbes.resolves({
			onlineProbesMap: new Map([ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ].entries()),
			allProbes: [ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ],
		});

		await runner.run({
			set,
			req,
			request: {
				body: {
					type: 'ping',
					target: 'jsdelivr.com',
					measurementOptions: {
						packets: 3,
					},
					locations: [],
					limit: 10,
					inProgressUpdates: false,
				},
			},
		} as unknown as Context);


		expect(router.findMatchingProbes.callCount).to.equal(1);
		expect(router.findMatchingProbes.args[0]).to.deep.equal([ [], 10 ]);
		expect(store.createMeasurement.callCount).to.equal(1);

		expect(store.createMeasurement.args[0]).to.deep.equal([
			{
				type: 'ping',
				target: 'jsdelivr.com',
				measurementOptions: { packets: 3 },
				locations: [],
				limit: 10,
				inProgressUpdates: false,
			},
			new Map([ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ].entries()),
			[ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ],
		]);

		expect(to.callCount).to.equal(4);
		expect(emit.callCount).to.equal(4);
		expect(to.args[0]![0]).to.equal(0);

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

		expect(to.args[1]![0]).to.equal(1);

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

		expect(to.args[2]![0]).to.equal(2);

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

		expect(to.args[3]![0]).to.equal(3);

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
		router.findMatchingProbes.resolves({
			onlineProbesMap: new Map([ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ].entries()),
			allProbes: [ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ],
		});

		await runner.run({
			set,
			req,
			request: {
				body: {
					type: 'ping',
					target: 'jsdelivr.com',
					measurementOptions: {
						packets: 3,
					},
					locations: [],
					limit: 10,
					inProgressUpdates: true,
				},
			},
		} as unknown as Context);


		expect(router.findMatchingProbes.callCount).to.equal(1);
		expect(router.findMatchingProbes.args[0]).to.deep.equal([ [], 10 ]);
		expect(store.createMeasurement.callCount).to.equal(1);

		expect(store.createMeasurement.args[0]).to.deep.equal([
			{
				type: 'ping',
				target: 'jsdelivr.com',
				measurementOptions: { packets: 3 },
				locations: [],
				limit: 10,
				inProgressUpdates: true,
			},
			new Map([ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ].entries()),
			[ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ],
		]);

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

	it('should properly handle result events from probes', async () => {
		const sandbox = sinon.createSandbox({ useFakeTimers: { now: new Date('2023-05-24T09:56:55.000Z').getTime() } });
		store.storeMeasurementResult
			.onFirstCall().resolves(null)
			.onSecondCall().resolves({ type: 'ping', createdAt: '2023-05-24T09:56:30.000Z' } as MeasurementRecord)
			.onThirdCall().resolves(null);

		await runner.recordResult({ measurementId: 'measurementid', testId: 'testid1', result: {} as MeasurementResultMessage['result'] });
		await runner.recordResult({ measurementId: 'measurementid', testId: 'testid2', result: {} as MeasurementResultMessage['result'] });
		await runner.recordResult({ measurementId: 'measurementid', testId: 'testid3', result: {} as MeasurementResultMessage['result'] });

		expect(store.storeMeasurementResult.callCount).to.equal(3);
		expect(store.storeMeasurementResult.args[0]).to.deep.equal([{ measurementId: 'measurementid', testId: 'testid1', result: {} }]);
		expect(store.storeMeasurementResult.args[1]).to.deep.equal([{ measurementId: 'measurementid', testId: 'testid2', result: {} }]);
		expect(store.storeMeasurementResult.args[2]).to.deep.equal([{ measurementId: 'measurementid', testId: 'testid3', result: {} }]);
		expect(metrics.recordMeasurementTime.callCount).to.equal(1);
		expect(metrics.recordMeasurementTime.args[0]).to.deep.equal([ 'ping', 25000 ]);
		sandbox.restore();
	});
});
