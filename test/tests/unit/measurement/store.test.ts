import * as td from 'testdouble';
import { expect } from 'chai';
import * as sinon from 'sinon';
import type { MeasurementStore } from '../../../../src/measurement/store.js';
import type { Probe } from '../../../../src/probe/types.js';

const getProbe = (id: string) => ({
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

describe('measurement store', () => {
	let getMeasurementStore: () => MeasurementStore;
	let sandbox: sinon.SinonSandbox;

	const redisMock = {
		hScan: sinon.stub(),
		hDel: sinon.stub(),
		hSet: sinon.stub(),
		set: sinon.stub(),
		expire: sinon.stub(),
		json: {
			mGet: sinon.stub(),
			set: sinon.stub(),
			strAppend: sinon.stub(),
		},
	};

	before(async () => {
		td.replaceEsm('crypto-random-string', null, () => 'measurementid');
		await td.replaceEsm('../../../../src/lib/redis/client.ts', { getRedisClient: () => redisMock });
		getMeasurementStore = (await import('../../../../src/measurement/store.js')).getMeasurementStore;
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox({ useFakeTimers: { now: 1_678_000_000_000 } });
		sandbox.stub(Math, 'random').returns(0.8);
		redisMock.hScan.reset();
		redisMock.hDel.reset();
		redisMock.hSet.reset();
		redisMock.set.reset();
		redisMock.expire.reset();
		redisMock.json.mGet.reset();
		redisMock.json.set.reset();
		redisMock.json.strAppend.reset();
	});

	afterEach(() => {
		sandbox.restore();
	});

	after(() => {
		td.reset();
	});

	it('should call proper redis methods during timeout checks', async () => {
		redisMock.hScan.resolves({ cursor: 0, tuples: [
			{ field: 'id1', value: '1677510747483' }, // Timed out measurement
			{ field: 'id2', value: '1677510747483' }, // Non-existing measurement
			{ field: 'id3', value: '2677510747483' }, // Not timed out measurement
		] });

		redisMock.json.mGet.resolves([{
			id: 'id1',
			type: 'ping',
			status: 'in-progress',
			createdAt: 1_677_510_747_483,
			updatedAt: 1_677_510_747_483,
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

		await sandbox.clock.tickAsync(16_000);

		expect(redisMock.hScan.callCount).to.equal(1);
		expect(redisMock.hScan.firstCall.args).to.deep.equal([ 'gp:in-progress', 0, { COUNT: 5000 }]);
		expect(redisMock.json.mGet.callCount).to.equal(1);
		expect(redisMock.json.mGet.firstCall.args).to.deep.equal([ [ 'gp:measurement:id1', 'gp:measurement:id2' ], '.' ]);
		expect(redisMock.hDel.callCount).to.equal(1);
		expect(redisMock.hDel.firstCall.args).to.deep.equal([ 'gp:in-progress', [ 'id1', 'id2' ] ]);
		expect(redisMock.json.set.callCount).to.equal(1);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([ 'gp:measurement:id1', '$', {
			id: 'id1',
			type: 'ping',
			status: 'finished',
			createdAt: 1_677_510_747_483,
			updatedAt: '2023-03-05T07:06:52.000Z',
			probesCount: 1,
			results: [{
				probe: {},
				result: {
					status: 'failed',
					rawOutput: '\n\nThe measurement timed out',
				},
			}],
		}]);
	});

	it('should initialize measurement object with the proper default values', async () => {
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'ping',
				measurementOptions: { packets: 3 },
				target: 'jsdelivr.com',
				locations: [],
				limit: 1,
				inProgressUpdates: false,
			},
			new Map([ [ 0, getProbe('id') ] ]),
			[ getProbe('id') ],
		);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			'gp:measurement:measurementid',
			'$',
			{
				id: 'measurementid',
				type: 'ping',
				status: 'in-progress',
				createdAt: '2023-03-05T07:06:40.000Z',
				updatedAt: '2023-03-05T07:06:40.000Z',
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
				},
				target: 'jsdelivr.com',
				locations: [],
				limit: 1,
				inProgressUpdates: false,
			},
			new Map([ [ 0, getProbe('id') ] ]),
			[ getProbe('id') ],
		);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			'gp:measurement:measurementid',
			'$',
			{
				id: 'measurementid',
				type: 'http',
				status: 'in-progress',
				createdAt: '2023-03-05T07:06:40.000Z',
				updatedAt: '2023-03-05T07:06:40.000Z',
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

	it('should store measurement probes in the same order as in arguments', async () => {
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'ping',
				measurementOptions: { packets: 3 },
				target: 'jsdelivr.com',
				locations: [],
				limit: 4,
				inProgressUpdates: false,
			},
			new Map([ getProbe('z'), getProbe('10'), getProbe('x'), getProbe('0') ].entries()),
			[ getProbe('z'), getProbe('10'), getProbe('x'), getProbe('0') ],
		);

		expect(redisMock.hSet.callCount).to.equal(1);
		expect(redisMock.hSet.args[0]).to.deep.equal([ 'gp:in-progress', 'measurementid', 1678000000000 ]);
		expect(redisMock.set.callCount).to.equal(1);
		expect(redisMock.set.args[0]).to.deep.equal([ 'gp:measurement:probes_awaiting:measurementid', 4, { EX: 35 }]);
		expect(redisMock.json.set.callCount).to.equal(2);

		expect(redisMock.json.set.args[0]).to.deep.equal([ 'gp:measurement:measurementid', '$', {
			id: 'measurementid',
			type: 'ping',
			status: 'in-progress',
			createdAt: '2023-03-05T07:06:40.000Z',
			updatedAt: '2023-03-05T07:06:40.000Z',
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

		expect(redisMock.expire.callCount).to.equal(2);
		expect(redisMock.expire.args[0]).to.deep.equal([ 'gp:measurement:measurementid', 604800 ]);
	});

	it('should store non-default fields of the measurement request', async () => {
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
			new Map([ [ 0, getProbe('id') ] ]),
			[ getProbe('id') ],
		);

		expect(redisMock.json.set.args[0]).to.deep.equal([ 'gp:measurement:measurementid', '$', {
			id: 'measurementid',
			type: 'http',
			status: 'in-progress',
			createdAt: '2023-03-05T07:06:40.000Z',
			updatedAt: '2023-03-05T07:06:40.000Z',
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

		expect(redisMock.expire.callCount).to.equal(2);
		expect(redisMock.expire.args[0]).to.deep.equal([ 'gp:measurement:measurementid', 604800 ]);
	});

	it('shouldn\'t store fields of the measurement request which are equal to the default', async () => {
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
				},
				target: 'jsdelivr.com',
				limit: 1,
				locations: [],
				inProgressUpdates: false,
			},
			new Map([ [ 0, getProbe('id') ] ]),
			[ getProbe('id') ],
		);

		expect(redisMock.json.set.args[0]).to.deep.equal([ 'gp:measurement:measurementid', '$', {
			id: 'measurementid',
			type: 'http',
			status: 'in-progress',
			createdAt: '2023-03-05T07:06:40.000Z',
			updatedAt: '2023-03-05T07:06:40.000Z',
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

		expect(redisMock.expire.callCount).to.equal(2);
		expect(redisMock.expire.args[0]).to.deep.equal([ 'gp:measurement:measurementid', 604800 ]);
	});

	it('should store rawHeaders and rawBody fields for the http in-progress updates', async () => {
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
			'gp:measurement:measurementid',
			'$.results[testid].result.rawHeaders',
			'headers',
		]);

		expect(redisMock.json.strAppend.secondCall.args).to.deep.equal([
			'gp:measurement:measurementid',
			'$.results[testid].result.rawBody',
			'body',
		]);

		expect(redisMock.json.strAppend.thirdCall.args).to.deep.equal([
			'gp:measurement:measurementid',
			'$.results[testid].result.rawOutput',
			'output',
		]);

		expect(redisMock.json.set.callCount).to.equal(1);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			'gp:measurement:measurementid',
			'$.updatedAt',
			'2023-03-05T07:06:40.000Z',
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
});
