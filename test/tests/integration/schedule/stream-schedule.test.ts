import { expect } from 'chai';
import * as sinon from 'sinon';
import nock from 'nock';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import { dashboardClient } from '../../../../src/lib/sql/client.js';
import { getStreamScheduleLoader } from '../../../../src/schedule/loader.js';
import { addFakeProbe, deleteFakeProbes, waitForProbesUpdate, getTestServer } from '../../../utils/server.js';

type ScheduleConfig = {
	id: string;
	name: string;
	measurement_type: 'http' | 'dns' | 'ping' | 'traceroute' | 'mtr';
	measurement_target: string;
	measurement_options: Record<string, unknown>;
	enabled: 0 | 1;
};

type ScheduleEntry = {
	id: string;
	name: string;
	mode: 'stream' | 'batch';
	interval: number;
	locations: Array<Record<string, unknown>>;
	probe_limit: number | null;
	time_series_enabled: 0 | 1;
	enabled: 0 | 1;
	configurations: ScheduleConfig[];
};

describe('Stream schedule execution', () => {
	const sandbox = sinon.createSandbox();
	const scheduleIds = new Set<string>();
	const configurationIds = new Set<string>();

	before(async () => {
		await getTestServer();
	});

	beforeEach(() => {
		sandbox.resetHistory();
		nockGeoIpProviders();
	});

	afterEach(async () => {
		if (configurationIds.size) {
			await dashboardClient('gp_schedule_configuration').whereIn('id', [ ...configurationIds ]).delete();
			configurationIds.clear();
		}

		if (scheduleIds.size) {
			await dashboardClient('gp_schedule').whereIn('id', [ ...scheduleIds ]).delete();
			scheduleIds.clear();
		}

		await deleteFakeProbes();
		await getStreamScheduleLoader().sync();
		nock.cleanAll();
	});

	const buildSchedule = (overrides: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
		id: 'schedule-1',
		name: 'stream schedule',
		mode: 'stream',
		interval: 1,
		locations: [],
		probe_limit: null,
		time_series_enabled: 0,
		enabled: 1,
		configurations: [
			{
				id: 'config-1',
				name: 'ping config',
				measurement_type: 'ping',
				measurement_target: 'example.com',
				measurement_options: {
					packets: 1,
					protocol: 'ICMP',
					port: 80,
					ipVersion: 4,
				},
				enabled: 1,
			},
		],
		...overrides,
	});

	const insertSchedule = async (schedule: ScheduleEntry) => {
		console.log(`Inserting schedule ${schedule.id}`);

		scheduleIds.add(schedule.id);
		schedule.configurations.forEach(config => configurationIds.add(config.id));

		await dashboardClient('gp_schedule').insert({
			id: schedule.id,
			user_created: '1',
			user_updated: null,
			date_created: dashboardClient.fn.now(),
			date_updated: null,
			name: schedule.name,
			mode: schedule.mode,
			interval: schedule.interval,
			probe_limit: schedule.probe_limit,
			locations: JSON.stringify(schedule.locations),
			enabled: schedule.enabled,
			time_series_enabled: schedule.time_series_enabled,
			notes: 'integration test',
		});

		const configRows = schedule.configurations.map(config => ({
			id: config.id,
			user_created: '1',
			user_updated: null,
			date_created: dashboardClient.fn.now(),
			date_updated: null,
			schedule_id: schedule.id,
			name: config.name,
			measurement_type: config.measurement_type,
			measurement_target: config.measurement_target,
			measurement_options: JSON.stringify(config.measurement_options),
			enabled: config.enabled,
			notes: 'integration test',
		}));

		await dashboardClient('gp_schedule_configuration').insert(configRows);
		await getStreamScheduleLoader().sync();
	};

	it('emits scheduled measurements to matching probes', async () => {
		console.log('starting test emits scheduled measurements to matching probes');
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule());

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.be.greaterThan(0);

		expect(requestHandlerStub.firstCall.args[0]).to.deep.include({
			testId: '0',
			measurement: {
				type: 'ping',
				target: 'example.com',
				protocol: 'ICMP',
				ipVersion: 4,
				packets: 1,
				port: 80,
				inProgressUpdates: false,
			},
		});
	});

	it('applies the location filter', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule({ locations: [{ country: 'PL' }] }));

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.equal(0);
	});

	it('skips disabled schedules', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule({ enabled: 0 }));

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.equal(0);
	});

	it('skips disabled configurations', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule({
			configurations: [
				{
					id: 'config-1',
					name: 'ping config',
					measurement_type: 'ping',
					measurement_target: 'example.com',
					measurement_options: {
						packets: 1,
						protocol: 'ICMP',
						port: 80,
						ipVersion: 4,
					},
					enabled: 0,
				},
			],
		}));

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.equal(0);
	});

	it('skips batch mode schedules', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule({ mode: 'batch' }));

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.equal(0);
	});

	it('emits measurements for multiple configurations', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule({
			configurations: [
				{
					id: 'config-1',
					name: 'ping config',
					measurement_type: 'ping',
					measurement_target: 'example.com',
					measurement_options: {
						packets: 1,
						protocol: 'ICMP',
						port: 80,
						ipVersion: 4,
					},
					enabled: 1,
				},
				{
					id: 'config-2',
					name: 'traceroute config',
					measurement_type: 'traceroute',
					measurement_target: 'example.org',
					measurement_options: {
						protocol: 'ICMP',
						port: 80,
						ipVersion: 4,
					},
					enabled: 1,
				},
			],
		}));

		await clock.tickAsyncStepped(60_000);

		const pingCalls = requestHandlerStub.getCalls().filter((c: sinon.SinonSpyCall) => c.args[0].measurement.type === 'ping');
		const tracerouteCalls = requestHandlerStub.getCalls().filter((c: sinon.SinonSpyCall) => c.args[0].measurement.type === 'traceroute');

		expect(pingCalls.length).to.be.greaterThan(0);
		expect(tracerouteCalls.length).to.be.greaterThan(0);

		expect(pingCalls[0]!.args[0]).to.deep.include({
			testId: '0',
			measurement: {
				type: 'ping',
				target: 'example.com',
				protocol: 'ICMP',
				ipVersion: 4,
				packets: 1,
				port: 80,
				inProgressUpdates: false,
			},
		});

		expect(tracerouteCalls[0]!.args[0]).to.deep.include({
			testId: '0',
			measurement: {
				type: 'traceroute',
				target: 'example.org',
				protocol: 'ICMP',
				ipVersion: 4,
				port: 80,
				inProgressUpdates: false,
			},
		});
	});

	it('emits only enabled configurations when mixed with disabled ones', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule({
			configurations: [
				{
					id: 'config-1',
					name: 'ping config',
					measurement_type: 'ping',
					measurement_target: 'example.com',
					measurement_options: {
						packets: 1,
						protocol: 'ICMP',
						port: 80,
						ipVersion: 4,
					},
					enabled: 1,
				},
				{
					id: 'config-2',
					name: 'disabled traceroute',
					measurement_type: 'traceroute',
					measurement_target: 'example.org',
					measurement_options: {
						protocol: 'ICMP',
						port: 80,
						ipVersion: 4,
					},
					enabled: 0,
				},
			],
		}));

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.be.greaterThan(0);

		const allTypes = requestHandlerStub.getCalls().map((c: sinon.SinonSpyCall) => c.args[0].measurement.type as string);
		expect(allTypes).to.include('ping');
		expect(allTypes).to.not.include('traceroute');
	});

	it('emits measurements to multiple probes', async () => {
		const requestHandlerStub1 = sandbox.stub();
		const requestHandlerStub2 = sandbox.stub();

		const probe1 = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub1,
		});

		probe1.emit('probe:status:update', 'ready');
		probe1.emit('probe:isIPv4Supported:update', true);

		nockGeoIpProviders();

		const probe2 = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub2,
		});

		probe2.emit('probe:status:update', 'ready');
		probe2.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule());

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub1.callCount).to.be.greaterThan(0);
		expect(requestHandlerStub2.callCount).to.be.greaterThan(0);
	});

	it('stops emitting measurements after schedule is disabled', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule());

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.be.greaterThan(0);

		await dashboardClient('gp_schedule').where({ id: 'schedule-1' }).update({ enabled: 0, date_updated: dashboardClient.fn.now() });
		await getStreamScheduleLoader().sync();

		requestHandlerStub.resetHistory();

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.equal(0);
	});

	it('picks up new schedules added via sync', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.equal(0);

		await insertSchedule(buildSchedule());

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.be.greaterThan(0);
	});

	it('updates timer when schedule interval changes', async () => {
		const requestHandlerStub = sandbox.stub();

		const probe = await addFakeProbe({
			'probe:measurement:request': requestHandlerStub,
		});

		probe.emit('probe:status:update', 'ready');
		probe.emit('probe:isIPv4Supported:update', true);
		await waitForProbesUpdate();

		await insertSchedule(buildSchedule({ interval: 1 }));

		await clock.tickAsyncStepped(60_000);

		const initialCalls = requestHandlerStub.callCount;
		expect(initialCalls).to.be.greaterThan(0);

		await dashboardClient('gp_schedule')
			.where({ id: 'schedule-1' })
			.update({ interval: 10, date_updated: dashboardClient.fn.now() });

		await getStreamScheduleLoader().sync();

		requestHandlerStub.resetHistory();

		await clock.tickAsyncStepped(60_000);

		expect(requestHandlerStub.callCount).to.be.lessThan(initialCalls);
	});
});
