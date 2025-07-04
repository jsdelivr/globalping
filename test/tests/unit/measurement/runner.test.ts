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
import createHttpError from 'http-errors';
import type { ExtendedContext } from '../../../../src/types.js';

const getProbe = (id: number) => ({ client: id } as unknown as Probe);

const req = {
	headers: {
		'x-client-ip': '1.1.1.1',
	},
};

describe('MeasurementRunner', () => {
	const sandbox = sinon.createSandbox();
	const set = sandbox.stub();
	const emit = sandbox.stub();
	const to = sandbox.stub();
	const io = sandbox.createStubInstance(Server);
	const store = sandbox.createStubInstance(MeasurementStore);
	const router = sandbox.createStubInstance(ProbeRouter);
	const metrics = sandbox.createStubInstance(MetricsAgent);
	const rateLimit = sandbox.stub();
	let runner: MeasurementRunner;
	let testId: number;

	before(async () => {
		await td.replaceEsm('crypto-random-string', null, () => testId++);
		const { MeasurementRunner } = await import('../../../../src/measurement/runner.js');
		runner = new MeasurementRunner(io, store, router, rateLimit, metrics);
	});

	beforeEach(() => {
		sandbox.resetHistory();
		to.returns({ emit });
		io.of.withArgs('/probes').returns({ to } as any);
		store.createMeasurement.resolves('measurementid');
		testId = 0;
	});

	afterEach(() => {
		clock.unpause();
	});

	after(() => {
		td.reset();
	});

	it('should run measurement for the required amount of probes', async () => {
		const request = {
			type: 'ping' as const,
			target: 'jsdelivr.com',
			measurementOptions: {
				packets: 3,
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
			} as const,
			locations: [],
			limit: 10,
			inProgressUpdates: false,
		};

		router.findMatchingProbes.resolves({
			onlineProbesMap: new Map([ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ].entries()),
			allProbes: [ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ],
			request,
		});

		await runner.run({
			set,
			req,
			request: {
				body: request,
			},
		} as unknown as ExtendedContext);


		expect(router.findMatchingProbes.callCount).to.equal(1);
		expect(router.findMatchingProbes.args[0]).to.deep.equal([ request ]);
		expect(store.createMeasurement.callCount).to.equal(1);

		expect(store.createMeasurement.args[0]).to.deep.equal([
			{
				type: 'ping',
				target: 'jsdelivr.com',
				measurementOptions: { packets: 3, ipVersion: 4, port: 80, protocol: 'ICMP' },
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
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
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
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
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
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
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
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '3',
		}]);

		expect(metrics.recordMeasurement.callCount).to.equal(1);
		expect(metrics.recordMeasurement.args[0]).to.deep.equal([ 'ping', 4 ]);
	});

	it('should send `inProgressUpdates: true` to the first N probes if requested', async () => {
		const request = {
			type: 'ping' as const,
			target: 'jsdelivr.com',
			measurementOptions: {
				packets: 3,
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
			} as const,
			locations: [],
			limit: 10,
			inProgressUpdates: true,
		};

		router.findMatchingProbes.resolves({
			onlineProbesMap: new Map([ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ].entries()),
			allProbes: [ getProbe(0), getProbe(1), getProbe(2), getProbe(3) ],
			request,
		});

		await runner.run({
			set,
			req,
			request: {
				body: request,
			},
		} as unknown as ExtendedContext);


		expect(router.findMatchingProbes.callCount).to.equal(1);
		expect(router.findMatchingProbes.args[0]).to.deep.equal([ request ]);
		expect(store.createMeasurement.callCount).to.equal(1);

		expect(store.createMeasurement.args[0]).to.deep.equal([
			{
				type: 'ping',
				target: 'jsdelivr.com',
				measurementOptions: { packets: 3, ipVersion: 4, port: 80, protocol: 'ICMP' },
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
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
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
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
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
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
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
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
				target: 'jsdelivr.com',
				type: 'ping',
			},
			measurementId: 'measurementid',
			testId: '3',
		}]);

		expect(metrics.recordMeasurement.callCount).to.equal(1);
		expect(metrics.recordMeasurement.args[0]).to.deep.equal([ 'ping', 4 ]);
	});

	it('should properly handle result events from probes', async () => {
		const start = clock.pause().now;

		store.storeMeasurementResult
			.onFirstCall().resolves(null)
			.onSecondCall().resolves({ type: 'ping', createdAt: new Date(start).toISOString() } as MeasurementRecord)
			.onThirdCall().resolves(null);

		await clock.tickAsync(25_000);
		await runner.recordResult({ measurementId: 'measurementid', testId: 'testid1', result: {} as MeasurementResultMessage['result'] });
		await runner.recordResult({ measurementId: 'measurementid', testId: 'testid2', result: {} as MeasurementResultMessage['result'] });
		await runner.recordResult({ measurementId: 'measurementid', testId: 'testid3', result: {} as MeasurementResultMessage['result'] });

		expect(store.storeMeasurementResult.callCount).to.equal(3);
		expect(store.storeMeasurementResult.args[0]).to.deep.equal([{ measurementId: 'measurementid', testId: 'testid1', result: {} }]);
		expect(store.storeMeasurementResult.args[1]).to.deep.equal([{ measurementId: 'measurementid', testId: 'testid2', result: {} }]);
		expect(store.storeMeasurementResult.args[2]).to.deep.equal([{ measurementId: 'measurementid', testId: 'testid3', result: {} }]);
		expect(metrics.recordMeasurementTime.callCount).to.equal(1);
		expect(metrics.recordMeasurementTime.args[0]).to.deep.equal([ 'ping', 25000 ]);
	});

	it('should call rate limiter with the number of online probes', async () => {
		const request = {
			type: 'ping' as const,
			target: 'jsdelivr.com',
			measurementOptions: {
				packets: 3,
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
			} as const,
			locations: [],
			limit: 10,
			inProgressUpdates: false,
		};

		router.findMatchingProbes.resolves({
			onlineProbesMap: new Map([ getProbe(0) ].entries()),
			allProbes: [ getProbe(0), getProbe(1) ],
			request,
		});

		const ctx = {
			set,
			req,
			request: {
				body: request,
			},
		} as unknown as ExtendedContext;

		await runner.run(ctx);

		expect(rateLimit.callCount).to.equal(1);
		expect(rateLimit.args[0]).to.deep.equal([ ctx, 1 ]);
	});

	it('should throw 422 error if no probes found', async () => {
		const request = {
			type: 'ping' as const,
			target: 'jsdelivr.com',
			measurementOptions: {
				packets: 3,
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
			} as const,
			locations: [],
			limit: 10,
			inProgressUpdates: false,
		};

		router.findMatchingProbes.resolves({
			onlineProbesMap: new Map([].entries()),
			allProbes: [],
			request,
		});

		const err = await runner.run({
			set,
			req,
			request: {
				body: request,
			},
		} as unknown as ExtendedContext).catch((err: unknown) => err);
		expect(err).to.deep.equal(createHttpError(422, 'No matching IPv4 probes available.', { type: 'no_probes_found' }));
		expect(store.markFinished.callCount).to.equal(0);
	});

	it('should immideately call store.markFinished if there are no online probes', async () => {
		const request = {
			type: 'ping' as const,
			target: 'jsdelivr.com',
			measurementOptions: {
				packets: 3,
				ipVersion: 4,
				port: 80,
				protocol: 'ICMP',
			} as const,
			locations: [],
			limit: 10,
			inProgressUpdates: false,
		};

		router.findMatchingProbes.resolves({
			onlineProbesMap: new Map([].entries()),
			allProbes: [ getProbe(0) ],
			request,
		});

		await runner.run({
			set,
			req,
			request: {
				body: request,
			},
		} as unknown as ExtendedContext);

		expect(store.markFinished.callCount).to.equal(1);
		expect(store.markFinished.args[0]).to.deep.equal([ 'measurementid' ]);
	});
});
