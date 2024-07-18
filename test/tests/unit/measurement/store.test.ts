import * as td from 'testdouble';
import { expect } from 'chai';
import * as sinon from 'sinon';
import relativeDayUtc from 'relative-day-utc';
import type { MeasurementStore } from '../../../../src/measurement/store.js';
import type { OfflineProbe, Probe } from '../../../../src/probe/types.js';
import type { PingResult } from '../../../../src/measurement/types.js';

const getProbe = (id: string, ip: string) => ({
	ipAddress: ip,
	altIpAddresses: [],
	location: {
		network: id,
		continent: 'continent',
		region: 'region',
		country: 'country',
		state: 'state',
		city: 'city',
		asn: 'asn',
		longitude: 'longitude',
		latitude: 'latitude',
	},
	tags: [],
	resolvers: [],
} as unknown as Probe);

const getOfflineProbe = (id: string, ip: string) => ({
	...getProbe(id, ip),
	status: 'offline',
} as unknown as OfflineProbe);

describe('measurement store', () => {
	let getMeasurementStore: () => MeasurementStore;

	const sandbox = sinon.createSandbox();
	const redisMock = {
		hScan: sandbox.stub(),
		hDel: sandbox.stub(),
		hSet: sandbox.stub(),
		set: sandbox.stub(),
		expire: sandbox.stub(),
		json: {
			mGet: sandbox.stub(),
			set: sandbox.stub(),
			strAppend: sandbox.stub(),
		},
		recordResult: sandbox.stub(),
		markFinished: sandbox.stub(),
	};

	sandbox.stub(Math, 'random').returns(0.8);

	before(async () => {
		await td.replaceEsm('crypto-random-string', null, () => 'measurementid');
		await td.replaceEsm('../../../../src/lib/redis/measurement-client.ts', { getMeasurementRedisClient: () => redisMock });
		getMeasurementStore = (await import('../../../../src/measurement/store.js')).getMeasurementStore;
	});

	beforeEach(() => {
		redisMock.recordResult.reset();
		sandbox.resetHistory();
	});

	afterEach(() => {
		clock.unpause();
	});

	after(() => {
		td.reset();
	});

	it('should call proper redis methods during timeout checks', async () => {
		const now = clock.pause().now;

		redisMock.hScan.resolves({ cursor: 0, tuples: [
			{ field: 'id1', value: relativeDayUtc(-1).valueOf() }, // Timed out measurement
			{ field: 'id2', value: relativeDayUtc(-1).valueOf() }, // Non-existing measurement
			{ field: 'id3', value: relativeDayUtc(1).valueOf() }, // Not timed out measurement
		] });

		redisMock.json.mGet.resolves([{
			id: 'id1',
			type: 'ping',
			status: 'in-progress',
			createdAt: new Date(now).toISOString(),
			updatedAt: new Date(now).toISOString(),
			probesCount: 1,
			results: [{
				probe: {},
				result: {
					status: 'in-progress',
					rawOutput: '',
				},
			}],
		}]);

		getMeasurementStore();

		await clock.tickAsync(16_000);

		expect(redisMock.hScan.callCount).to.equal(1);
		expect(redisMock.hScan.firstCall.args).to.deep.equal([ 'gp:in-progress', 0, { COUNT: 5000 }]);
		expect(redisMock.json.mGet.callCount).to.equal(1);
		expect(redisMock.json.mGet.firstCall.args).to.deep.equal([ [ 'gp:m:id1:results', 'gp:m:id2:results' ], '.' ]);
		expect(redisMock.hDel.callCount).to.equal(1);
		expect(redisMock.hDel.firstCall.args).to.deep.equal([ 'gp:in-progress', [ 'id1', 'id2' ] ]);
		expect(redisMock.json.set.callCount).to.equal(1);

		expect(redisMock.json.set.firstCall.args).to.have.lengthOf(3);
		expect(redisMock.json.set.firstCall.args[0]).to.equal('gp:m:id1:results');
		expect(redisMock.json.set.firstCall.args[1]).to.equal('$');

		expect(redisMock.json.set.firstCall.args[2]).to.deep.include({
			id: 'id1',
			type: 'ping',
			status: 'finished',
			createdAt: new Date(now).toISOString(),
			probesCount: 1,
			results: [{
				probe: {},
				result: {
					status: 'failed',
					rawOutput: '\n\nThe measurement timed out',
				},
			}],
		});

		expect(new Date(redisMock.json.set.firstCall.args[2].updatedAt)).to.be.within(new Date(now + 1), new Date(now + 16_000));
	});

	it('should store measurement probes in the same order as in arguments', async () => {
		const now = clock.pause().now;
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'ping',
				measurementOptions: { packets: 3, ipVersion: 4 },
				target: 'jsdelivr.com',
				locations: [],
				limit: 4,
				inProgressUpdates: false,
			},
			new Map([ getProbe('z', '1.1.1.1'), getProbe('10', '2.2.2.2'), getProbe('x', '3.3.3.3'), getProbe('0', '4.4.4.4') ].entries()),
			[ getProbe('z', '1.1.1.1'), getProbe('10', '2.2.2.2'), getProbe('x', '3.3.3.3'), getProbe('0', '4.4.4.4') ],
		);

		expect(redisMock.hSet.callCount).to.equal(1);
		expect(redisMock.hSet.args[0]).to.deep.equal([ 'gp:in-progress', 'measurementid', now ]);
		expect(redisMock.set.callCount).to.equal(1);
		expect(redisMock.set.args[0]).to.deep.equal([ 'gp:m:measurementid:probes_awaiting', 4, { EX: 35 }]);
		expect(redisMock.json.set.callCount).to.equal(2);

		expect(redisMock.json.set.args[0]).to.deep.equal([ 'gp:m:measurementid:results', '$', {
			id: 'measurementid',
			type: 'ping',
			status: 'in-progress',
			createdAt: new Date(now).toISOString(),
			updatedAt: new Date(now).toISOString(),
			target: 'jsdelivr.com',
			limit: 4,
			probesCount: 4,
			results: [{
				probe: {
					continent: 'continent',
					region: 'region',
					country: 'country',
					state: 'state',
					city: 'city',
					asn: 'asn',
					longitude: 'longitude',
					latitude: 'latitude',
					network: 'z',
					tags: [],
					resolvers: [],
				},
				result: { status: 'in-progress', rawOutput: '' },
			},
			{
				probe: {
					continent: 'continent',
					region: 'region',
					country: 'country',
					state: 'state',
					city: 'city',
					asn: 'asn',
					longitude: 'longitude',
					latitude: 'latitude',
					network: '10',
					tags: [],
					resolvers: [],
				},
				result: { status: 'in-progress', rawOutput: '' },
			},
			{
				probe: {
					continent: 'continent',
					region: 'region',
					country: 'country',
					state: 'state',
					city: 'city',
					asn: 'asn',
					longitude: 'longitude',
					latitude: 'latitude',
					network: 'x',
					tags: [],
					resolvers: [],
				},
				result: { status: 'in-progress', rawOutput: '' },
			},
			{
				probe: {
					continent: 'continent',
					region: 'region',
					country: 'country',
					state: 'state',
					city: 'city',
					asn: 'asn',
					longitude: 'longitude',
					latitude: 'latitude',
					network: '0',
					tags: [],
					resolvers: [],
				},
				result: { status: 'in-progress', rawOutput: '' },
			}],
		}]);

		expect(redisMock.expire.args[0]).to.deep.equal([ 'gp:m:measurementid:results', 604800 ]);

		expect(redisMock.json.set.args[1]).to.deep.equal([ 'gp:m:measurementid:ips', '$', [ '1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4' ] ]);

		expect(redisMock.expire.args[1]).to.deep.equal([ 'gp:m:measurementid:ips', 604800 ]);
	});

	it('should initialize measurement object with the proper default values', async () => {
		const now = clock.pause().now;
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'ping',
				measurementOptions: { packets: 3, ipVersion: 4 },
				target: 'jsdelivr.com',
				locations: [],
				limit: 1,
				inProgressUpdates: false,
			},
			new Map([ [ 0, getProbe('id', '1.1.1.1') ] ]),
			[ getProbe('id', '1.1.1.1') ],
		);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			'gp:m:measurementid:results',
			'$',
			{
				id: 'measurementid',
				type: 'ping',
				status: 'in-progress',
				createdAt: new Date(now).toISOString(),
				updatedAt: new Date(now).toISOString(),
				target: 'jsdelivr.com',
				probesCount: 1,
				results: [
					{
						probe: {
							continent: 'continent',
							region: 'region',
							country: 'country',
							state: 'state',
							city: 'city',
							asn: 'asn',
							longitude: 'longitude',
							latitude: 'latitude',
							network: 'id',
							tags: [],
							resolvers: [],
						},
						result: { status: 'in-progress', rawOutput: '' },
					},
				],
			},
		]);
	});

	it('should initialize measurement object with the proper default values in case of http measurement', async () => {
		const now = clock.pause().now;
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'http',
				measurementOptions: {
					request: {
						method: 'HEAD',
						path: '/',
						query: '',
						headers: {},
					},
					protocol: 'HTTPS',
					ipVersion: 4,
				},
				target: 'jsdelivr.com',
				locations: [],
				limit: 1,
				inProgressUpdates: false,
			},
			new Map([ [ 0, getProbe('id', '1.1.1.1') ] ]),
			[ getProbe('id', '1.1.1.1') ],
		);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			'gp:m:measurementid:results',
			'$',
			{
				id: 'measurementid',
				type: 'http',
				status: 'in-progress',
				createdAt: new Date(now).toISOString(),
				updatedAt: new Date(now).toISOString(),
				target: 'jsdelivr.com',
				probesCount: 1,
				results: [
					{
						probe: {
							continent: 'continent',
							region: 'region',
							country: 'country',
							state: 'state',
							city: 'city',
							asn: 'asn',
							longitude: 'longitude',
							latitude: 'latitude',
							network: 'id',
							tags: [],
							resolvers: [],
						},
						result: {
							status: 'in-progress',
							rawHeaders: '',
							rawBody: '',
							rawOutput: '',
						},
					},
				],
			},
		]);
	});

	it('should initialize measurement object with the proper default in case of offline probes', async () => {
		const now = clock.pause().now;
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'ping',
				measurementOptions: { packets: 3, ipVersion: 4 },
				target: 'jsdelivr.com',
				locations: [],
				limit: 1,
				inProgressUpdates: false,
			},
			new Map(),
			[ getOfflineProbe('id', '1.1.1.1') ],
		);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			'gp:m:measurementid:results',
			'$',
			{
				id: 'measurementid',
				type: 'ping',
				status: 'in-progress',
				createdAt: new Date(now).toISOString(),
				updatedAt: new Date(now).toISOString(),
				target: 'jsdelivr.com',
				probesCount: 1,
				results: [
					{
						probe: {
							continent: 'continent',
							region: 'region',
							country: 'country',
							state: 'state',
							city: 'city',
							asn: 'asn',
							longitude: 'longitude',
							latitude: 'latitude',
							network: 'id',
							tags: [],
							resolvers: [],
						},
						result: {
							status: 'offline',
							rawOutput: 'This probe is currently offline. Please try again later.',
						},
					},
				],
			},
		]);

		expect(redisMock.set.args[0]).to.deep.equal([ 'gp:m:measurementid:probes_awaiting', 0, { EX: 35 }]);
	});

	it('should store non-default fields of the measurement request', async () => {
		const now = clock.pause().now;
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'http',
				measurementOptions: {
					request: {
						method: 'GET',
						path: '/path',
						query: 'query',
						headers: {
							headername: 'headervalue',
						},
					},
					protocol: 'HTTP',
					ipVersion: 4,
				},
				target: 'jsdelivr.com',
				locations: [{
					magic: 'EU',
					limit: 2,
				}, {
					magic: 'US',
					limit: 2,
				}],
				limit: 2,
				inProgressUpdates: false,
			},
			new Map([ [ 0, getProbe('id', '1.1.1.1') ] ]),
			[ getProbe('id', '1.1.1.1') ],
		);

		expect(redisMock.json.set.args[0]).to.deep.equal([ 'gp:m:measurementid:results', '$', {
			id: 'measurementid',
			type: 'http',
			status: 'in-progress',
			createdAt: new Date(now).toISOString(),
			updatedAt: new Date(now).toISOString(),
			target: 'jsdelivr.com',
			probesCount: 1,
			measurementOptions: {
				protocol: 'HTTP',
				request: {
					headers: { headername: 'headervalue' },
					method: 'GET',
					path: '/path',
					query: 'query',
				},
			},
			locations: [{ limit: 2, magic: 'EU' }, { limit: 2, magic: 'US' }],
			results: [{
				probe: {
					continent: 'continent',
					region: 'region',
					country: 'country',
					state: 'state',
					city: 'city',
					asn: 'asn',
					longitude: 'longitude',
					latitude: 'latitude',
					network: 'id',
					tags: [],
					resolvers: [],
				},
				result: {
					status: 'in-progress',
					rawHeaders: '',
					rawBody: '',
					rawOutput: '',
				},
			}],
		}]);
	});

	it('shouldn\'t store fields of the measurement request which are equal to the default', async () => {
		const now = clock.pause().now;
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'http',
				measurementOptions: {
					request: {
						method: 'HEAD',
						path: '/',
						query: '',
						headers: {},
					},
					protocol: 'HTTPS',
					ipVersion: 4,
				},
				target: 'jsdelivr.com',
				limit: 1,
				locations: [],
				inProgressUpdates: false,
			},
			new Map([ [ 0, getProbe('id', '1.1.1.1') ] ]),
			[ getProbe('id', '1.1.1.1') ],
		);

		expect(redisMock.json.set.args[0]).to.deep.equal([ 'gp:m:measurementid:results', '$', {
			id: 'measurementid',
			type: 'http',
			status: 'in-progress',
			createdAt: new Date(now).toISOString(),
			updatedAt: new Date(now).toISOString(),
			target: 'jsdelivr.com',
			probesCount: 1,
			results: [{
				probe: {
					continent: 'continent',
					region: 'region',
					country: 'country',
					state: 'state',
					city: 'city',
					asn: 'asn',
					longitude: 'longitude',
					latitude: 'latitude',
					network: 'id',
					tags: [],
					resolvers: [],
				},
				result: {
					status: 'in-progress',
					rawHeaders: '',
					rawBody: '',
					rawOutput: '',
				},
			}],
		}]);
	});

	it('should store rawHeaders and rawBody fields for the http in-progress updates', async () => {
		const now = clock.pause().now;
		const store = getMeasurementStore();
		await store.storeMeasurementProgress({
			testId: 'testid',
			measurementId: 'measurementid',
			result: {
				rawHeaders: 'headers',
				rawBody: 'body',
				rawOutput: 'output',
			},
		});

		expect(redisMock.json.strAppend.callCount).to.equal(3);

		expect(redisMock.json.strAppend.firstCall.args).to.deep.equal([
			'gp:m:measurementid:results',
			'$.results[testid].result.rawHeaders',
			'headers',
		]);

		expect(redisMock.json.strAppend.secondCall.args).to.deep.equal([
			'gp:m:measurementid:results',
			'$.results[testid].result.rawBody',
			'body',
		]);

		expect(redisMock.json.strAppend.thirdCall.args).to.deep.equal([
			'gp:m:measurementid:results',
			'$.results[testid].result.rawOutput',
			'output',
		]);

		expect(redisMock.json.set.callCount).to.equal(1);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			'gp:m:measurementid:results',
			'$.updatedAt',
			new Date(now).toISOString(),
		]);
	});

	it('should call redis.json.set instead of redis.json.strAppend if `overwrite` is true', async () => {
		const store = getMeasurementStore();
		await store.storeMeasurementProgress({
			testId: 'testid',
			measurementId: 'measurementid',
			overwrite: true,
			result: {
				rawOutput: 'output',
			},
		});

		expect(redisMock.json.strAppend.callCount).to.equal(0);
		expect(redisMock.json.set.callCount).to.equal(2);
	});

	it('should mark measurement as finished if storeMeasurementResult returned record', async () => {
		redisMock.recordResult.resolves({});

		const store = getMeasurementStore();
		await store.storeMeasurementResult({
			testId: 'testid',
			measurementId: 'measurementid',
			result: {
				status: 'finished',
				rawOutput: 'output',
			} as PingResult,
		});

		expect(redisMock.recordResult.callCount).to.equal(1);

		expect(redisMock.recordResult.args[0]).to.deep.equal([
			'measurementid',
			'testid',
			{ status: 'finished', rawOutput: 'output' },
		]);

		expect(redisMock.markFinished.callCount).to.equal(1);
		expect(redisMock.markFinished.args[0]).to.deep.equal([ 'measurementid' ]);
	});

	it('should not mark measurement as finished if storeMeasurementResult didn\'t return record', async () => {
		const store = getMeasurementStore();
		await store.storeMeasurementResult({
			testId: 'testid',
			measurementId: 'measurementid',
			result: {
				status: 'finished',
				rawOutput: 'output',
			} as PingResult,
		});

		expect(redisMock.recordResult.callCount).to.equal(1);

		expect(redisMock.recordResult.args[0]).to.deep.equal([
			'measurementid',
			'testid',
			{ status: 'finished', rawOutput: 'output' },
		]);

		expect(redisMock.markFinished.callCount).to.equal(0);
	});
});
