import request, { type Agent } from 'supertest';
import * as td from 'testdouble';
import nock from 'nock';
import type { Socket } from 'socket.io-client';
import * as sinon from 'sinon';
import { expect } from 'chai';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { waitFor } from '../../../utils/wait.js';
import * as id from '../../../../src/measurement/id.js';
import { dashboardClient, timeSeriesClient } from '../../../../src/lib/sql/client.js';
import type { RedisClient } from '../../../../src/lib/redis/shared.js';
import type { ProbeTestStats } from '../../../../src/probe/test-stats.js';
import { createEmptyCounters } from '../../../../src/probe/test-stats-storage.js';

const HOUR = 60 * 60 * 1000;
const PROBE_UUID = '11111111-1111-4111-8111-111111111111';

describe('Probe test stats of measurements', function () {
	this.timeout(60_000);

	const sandbox = sinon.createSandbox();
	const measurementIds: string[] = [];
	const requestHandlerStub = sandbox.stub();
	let redis: RedisClient;
	let probe: Socket;
	let requestAgent: Agent;
	let waitForProbesUpdate: () => Promise<void>;
	let addFakeProbe: typeof import('../../../utils/server.js').addFakeProbe;
	let deleteFakeProbes: () => Promise<void>;
	let probeTestStats: ProbeTestStats;
	let syncSchedules: () => Promise<void>;
	let hour: number;

	const generateMeasurementId = sandbox.stub().callsFake((_createdAt: Date, userType?: Parameters<typeof id.generateMeasurementId>[1]) => {
		const measurementId = id.generateMeasurementId(new Date(hour), userType);
		measurementIds.push(measurementId);
		return measurementId;
	});

	const getRows = () => timeSeriesClient('probe_test_stats_hourly')
		.select('probeUuid', 'testType', 'assigned', 'finished', 'failedTarget', 'failedResolver', 'failedInternal', 'timedOut')
		.where('hour', new Date(hour))
		.orderBy('probeUuid');

	const waitForMeasurements = () => {
		const deadline = Date.now() + 20_000;

		return waitFor(async () => {
			expect(Date.now(), 'Measurements did not finish before the deadline.').to.be.lessThan(deadline);
			const responses = await Promise.all(measurementIds.map(measurementId => requestAgent.get(`/v1/measurements/${measurementId}`).timeout(5000).send()));
			return responses.every(response => response.body.status === 'finished');
		}, 200);
	};

	const deleteSchedule = async () => {
		await dashboardClient('gp_schedule').where({ id: 'stats-schedule' }).delete();
		await syncSchedules();
	};

	before(async () => {
		await td.replaceEsm('../../../../src/measurement/id.ts', { ...id, generateMeasurementId }, {});
		await td.replaceEsm('../../../../src/lib/cloud-ip-ranges.ts', { getCloudTags: () => [], populateMemList: () => Promise.resolve() });

		const server = await import('../../../utils/server.js');
		({ waitForProbesUpdate, addFakeProbe, deleteFakeProbes } = server);
		requestAgent = request(await server.getTestServer());

		// Import after module replacement to use the server's instances.
		const { getPersistentNoEvictionRedisClient } = await import('../../../../src/lib/redis/persistent-no-eviction-client.js');
		const { getProbeTestStats } = await import('../../../../src/probe/test-stats.js');
		const { getStreamScheduleLoader } = await import('../../../../src/schedule/loader.js');
		redis = getPersistentNoEvictionRedisClient();
		probeTestStats = getProbeTestStats();
		syncSchedules = () => getStreamScheduleLoader().sync();
	});

	beforeEach(async () => {
		const keys = await redis.keys('gp:probe-test-stats:*');
		keys.length && await redis.del(keys);
		await timeSeriesClient('probe_test_stats_hourly').delete();
		measurementIds.length = 0;
		hour = Math.floor(Date.now() / HOUR) * HOUR - 3 * HOUR;
		sandbox.resetHistory();

		nockGeoIpProviders();
		probe = await addFakeProbe({ 'probe:measurement:request': requestHandlerStub });
		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		probe.emit('probe:isIPv6Supported:update', true);
		await waitForProbesUpdate();
	});

	afterEach(async () => {
		await deleteSchedule();
		requestHandlerStub.reset();
		await deleteFakeProbes();
		nock.cleanAll();
	});

	after(() => {
		td.reset();
	});

	it('counts the tests of regular measurements', async () => {
		const pingResult = { rawOutput: '', resolvedHostname: 'jsdelivr.com', resolvedAddress: '1.1.1.1', timings: [], stats: { min: 1, avg: 1, max: 1, total: 4, rcv: 4, drop: 0, loss: 0 } };

		requestHandlerStub.callsFake(({ measurementId, testId, measurement }) => {
			if (measurement.target === 'finished.example') {
				probe.emit('probe:measurement:result', { measurementId, testId, result: { status: 'finished', ...pingResult } });
			} else if (measurement.target === 'failed.example') {
				probe.emit('probe:measurement:result', { measurementId, testId, result: { status: 'failed', failureSource: 'target', rawOutput: 'Unreachable.' } });
			}
		});

		for (const target of [ 'finished.example', 'finished.example', 'failed.example', 'timeout.example' ]) {
			await requestAgent.post('/v1/measurements').send({ type: 'ping', target, measurementOptions: { packets: 4 }, timeout: 5 }).expect(202);
		}

		await waitForMeasurements();
		await probeTestStats.flush();

		expect(await getRows()).to.deep.equal([
			{ probeUuid: PROBE_UUID, testType: 'ping', ...createEmptyCounters(), assigned: 4, finished: 2, failedTarget: 1, failedInternal: 1, timedOut: 1 },
		]);
	});

	it('attributes a timeout to the probe that did not respond', async () => {
		const silentUuid = '22222222-2222-4222-8222-222222222222';
		nockGeoIpProviders({ ipmap: 'empty', ip2location: 'empty', maxmind: 'empty', ipinfo: 'turkey', fastly: 'empty' });
		const silentProbe = await addFakeProbe({}, { query: { uuid: silentUuid } });

		silentProbe.emit('probe:status:update', 'ready');
		silentProbe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		requestHandlerStub.callsFake(({ measurementId, testId }) => {
			probe.emit('probe:measurement:result', { measurementId, testId, result: { status: 'finished', rawOutput: '', statusCodeName: 'NOERROR', statusCode: 0, resolver: '1.1.1.1', timings: { total: 1 }, answers: [] } });
		});

		await requestAgent.post('/v1/measurements').send({ type: 'dns', target: 'example.com', locations: [{ country: 'US' }, { country: 'TR' }], timeout: 5 }).expect(202);
		await waitForMeasurements();

		expect(requestHandlerStub.args.map(([ message ]) => message.testId)).to.deep.equal([ '0' ]);

		await probeTestStats.flush();

		expect(await getRows()).to.deep.equal([
			{ probeUuid: PROBE_UUID, testType: 'dns', ...createEmptyCounters(), assigned: 1, finished: 1 },
			{ probeUuid: silentUuid, testType: 'dns', ...createEmptyCounters(), assigned: 1, failedInternal: 1, timedOut: 1 },
		]);
	});

	it('counts the tests of scheduled measurements', async () => {
		requestHandlerStub.callsFake(({ measurementId, testId }) => {
			probe.emit('probe:measurement:result', { measurementId, testId, result: { status: 'finished', rawOutput: '', statusCodeName: 'NOERROR', statusCode: 0, resolver: '1.1.1.1', timings: { total: 1 }, answers: [] } });
		});

		await dashboardClient('gp_schedule').insert({ id: 'stats-schedule', user_created: '1', name: 'stats', mode: 'stream', interval: 1, locations: '[]', enabled: 1, time_series_enabled: 0 });
		await dashboardClient('gp_schedule_configuration').insert({ id: 'stats-configuration', user_created: '1', schedule_id: 'stats-schedule', name: 'dns', measurement_type: 'dns', measurement_target: 'example.com', measurement_options: '{}', enabled: 1 });
		await syncSchedules();

		await waitFor(() => requestHandlerStub.callCount >= 2, 50);
		await deleteSchedule();
		await waitForMeasurements();
		await probeTestStats.flush();

		expect(await getRows()).to.deep.equal([
			{ probeUuid: PROBE_UUID, testType: 'dns', ...createEmptyCounters(), assigned: measurementIds.length, finished: measurementIds.length },
		]);
	});
});
