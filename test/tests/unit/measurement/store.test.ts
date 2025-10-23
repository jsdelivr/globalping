import config from 'config';
import * as td from 'testdouble';
import { expect } from 'chai';
import * as sinon from 'sinon';
import relativeDayUtc from 'relative-day-utc';
import * as id from '../../../../src/measurement/id.js';
import type { MeasurementStore } from '../../../../src/measurement/store.js';
import type { OfflineProbe, ServerProbe } from '../../../../src/probe/types.js';
import type { PingResult } from '../../../../src/measurement/types.js';

const getProbe = (id: string, ip: string) => ({
	ipAddress: ip,
	uuid: `${id}-${id}-${id}-${id}-${id}`,
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
} as unknown as ServerProbe);

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
		hExpire: sandbox.stub(),
		set: sandbox.stub(),
		expire: sandbox.stub(),
		del: sandbox.stub(),
		json: {
			get: sandbox.stub(),
			set: sandbox.stub(),
		},
		recordProgress: sandbox.stub(),
		recordProgressAppend: sandbox.stub(),
		recordResult: sandbox.stub(),
		markFinished: sandbox.stub(),
	};

	const persistentRedisMock = {
		zAdd: sandbox.stub(),
		zRemRangeByScore: sandbox.stub(),
	};

	const mockedMeasurementId1 = '2E2SZgEwA6W6HvzlT0001z9VK';
	const mockedMeasurementId2 = '2F2SZgEwA6W6HvzlT0001z9VK';
	const mockedMeasurementId3 = '2G2SZgEwA6W6HvzlT0001z9VK';

	sandbox.stub(Math, 'random').returns(0.8);

	before(async () => {
		await td.replaceEsm('../../../../src/measurement/id.ts', { ...id, generateMeasurementId: () => mockedMeasurementId1 }, {});
		await td.replaceEsm('../../../../src/lib/redis/measurement-client.ts', { getMeasurementRedisClient: () => redisMock });
		await td.replaceEsm('../../../../src/lib/redis/persistent-client.ts', { getPersistentRedisClient: () => persistentRedisMock });
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

		redisMock.hScan.resolves({
			cursor: 0,
			tuples: [
				{ field: mockedMeasurementId1, value: relativeDayUtc(-1).valueOf() }, // Timed out measurement
				{ field: mockedMeasurementId2, value: relativeDayUtc(-1).valueOf() }, // Non-existing measurement
				{ field: mockedMeasurementId3, value: relativeDayUtc(1).valueOf() }, // Not timed out measurement
			],
		});

		redisMock.json.get.onFirstCall().resolves({
			id: mockedMeasurementId1,
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
		});

		redisMock.json.get.onSecondCall().resolves(null);

		getMeasurementStore();

		await clock.tickAsync(16_000);

		expect(redisMock.hScan.callCount).to.equal(1);
		expect(redisMock.hScan.firstCall.args).to.deep.equal([ 'gp:in-progress', 0, { COUNT: 5000 }]);
		expect(redisMock.json.get.callCount).to.equal(2);
		expect(redisMock.json.get.firstCall.args).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:results` ]);
		expect(redisMock.json.get.secondCall.args).to.deep.equal([ `gp:m:{${mockedMeasurementId2}}:results` ]);
		expect(redisMock.hDel.callCount).to.equal(1);
		expect(redisMock.hDel.firstCall.args).to.deep.equal([ 'gp:in-progress', [ mockedMeasurementId1, mockedMeasurementId2 ] ]);
		expect(persistentRedisMock.zRemRangeByScore.callCount).to.equal(1);
		expect(persistentRedisMock.zRemRangeByScore.firstCall.args[2]).to.be.within((now - config.get<number>('measurement.resultTTL') * 1000) * 1000, Date.now() * 1000);
		expect(redisMock.del.callCount).to.equal(2);
		expect(redisMock.del.firstCall.args).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:probes_awaiting` ]);
		expect(redisMock.del.secondCall.args).to.deep.equal([ `gp:m:{${mockedMeasurementId2}}:probes_awaiting` ]);
		expect(redisMock.json.set.callCount).to.equal(1);

		expect(redisMock.json.set.firstCall.args).to.have.lengthOf(3);
		expect(redisMock.json.set.firstCall.args[0]).to.equal(`gp:m:{${mockedMeasurementId1}}:results`);
		expect(redisMock.json.set.firstCall.args[1]).to.equal('$');

		expect(redisMock.json.set.firstCall.args[2]).to.deep.include({
			id: mockedMeasurementId1,
			type: 'ping',
			status: 'finished',
			createdAt: new Date(now).toISOString(),
			probesCount: 1,
			results: [{
				probe: {},
				result: {
					status: 'failed',
					rawOutput: '\n\nThe measurement timed out.',
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
				measurementOptions: { packets: 3, ipVersion: 4, port: 80, protocol: 'ICMP' },
				target: 'jsdelivr.com',
				locations: [],
				limit: 4,
				inProgressUpdates: false,
			},
			new Map([ getProbe('z', '1.1.1.1'), getProbe('10', '2.2.2.2'), getProbe('x', '3.3.3.3'), getProbe('0', '4.4.4.4') ].entries()),
			[ getProbe('z', '1.1.1.1'), getProbe('10', '2.2.2.2'), getProbe('x', '3.3.3.3'), getProbe('0', '4.4.4.4') ],
		);

		expect(redisMock.hSet.callCount).to.equal(2);

		expect(redisMock.hSet.args[0]).to.deep.equal([ 'gp:in-progress', mockedMeasurementId1, now ]);
		expect(redisMock.set.callCount).to.equal(1);
		expect(redisMock.set.args[0]).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:probes_awaiting`, 4, { EX: 60 }]);
		expect(redisMock.json.set.callCount).to.equal(2);

		expect(redisMock.json.set.args[0]).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:results`, '$', {
			id: mockedMeasurementId1,
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

		expect(redisMock.expire.args[0]).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:results`, 604800 ]);

		expect(redisMock.json.set.args[1]).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:ips`, '$', [ '1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4' ] ]);

		expect(redisMock.expire.args[1]).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:ips`, 604800 ]);

		expect(redisMock.hSet.args[1]).to.deep.equal([ 'gp:test-to-probe', {
			[`${mockedMeasurementId1}_0`]: 'z-z-z-z-z',
			[`${mockedMeasurementId1}_1`]: '10-10-10-10-10',
			[`${mockedMeasurementId1}_2`]: 'x-x-x-x-x',
			[`${mockedMeasurementId1}_3`]: '0-0-0-0-0',
		}]);

		expect(redisMock.hExpire.callCount).to.equal(1);

		expect(redisMock.hExpire.args[0]).to.deep.equal([
			'gp:test-to-probe',
			[
				`${mockedMeasurementId1}_0`,
				`${mockedMeasurementId1}_1`,
				`${mockedMeasurementId1}_2`,
				`${mockedMeasurementId1}_3`,
			],
			150,
		]);
	});

	it('should initialize measurement object with the proper default values', async () => {
		const now = clock.pause().now;
		const store = getMeasurementStore();
		await store.createMeasurement(
			{
				type: 'ping',
				measurementOptions: { packets: 3, ipVersion: 4, port: 80, protocol: 'ICMP' },
				target: 'jsdelivr.com',
				locations: [],
				limit: 1,
				inProgressUpdates: false,
			},
			new Map([ [ 0, getProbe('id', '1.1.1.1') ] ]),
			[ getProbe('id', '1.1.1.1') ],
		);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			`gp:m:{${mockedMeasurementId1}}:results`,
			'$',
			{
				id: mockedMeasurementId1,
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
			`gp:m:{${mockedMeasurementId1}}:results`,
			'$',
			{
				id: mockedMeasurementId1,
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
				measurementOptions: { packets: 3, ipVersion: 4, port: 80, protocol: 'ICMP' },
				target: 'jsdelivr.com',
				locations: [],
				limit: 1,
				inProgressUpdates: false,
			},
			new Map(),
			[ getOfflineProbe('id', '1.1.1.1') ],
		);

		expect(redisMock.json.set.firstCall.args).to.deep.equal([
			`gp:m:{${mockedMeasurementId1}}:results`,
			'$',
			{
				id: mockedMeasurementId1,
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

		expect(redisMock.set.args[0]).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:probes_awaiting`, 0, { EX: 60 }]);
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

		expect(redisMock.json.set.args[0]).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:results`, '$', {
			id: mockedMeasurementId1,
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

		expect(redisMock.json.set.args[0]).to.deep.equal([ `gp:m:{${mockedMeasurementId1}}:results`, '$', {
			id: mockedMeasurementId1,
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
		const store = getMeasurementStore();
		await store.storeMeasurementProgress({
			testId: 'testid',
			measurementId: mockedMeasurementId1,
			result: {
				rawHeaders: 'headers',
				rawBody: 'body',
				rawOutput: 'output',
			},
		});

		expect(redisMock.recordProgressAppend.callCount).to.equal(1);

		expect(redisMock.recordProgressAppend.firstCall.args).to.deep.equal([
			mockedMeasurementId1,
			'testid',
			{ rawHeaders: 'headers', rawBody: 'body', rawOutput: 'output' },
		]);
	});

	it('should call redis.json.set instead of redis.json.strAppend if `overwrite` is true', async () => {
		const store = getMeasurementStore();
		await store.storeMeasurementProgress({
			testId: 'testid',
			measurementId: mockedMeasurementId1,
			overwrite: true,
			result: {
				rawOutput: 'output',
			},
		});

		expect(redisMock.recordProgressAppend.callCount).to.equal(0);

		expect(redisMock.recordProgress.callCount).to.equal(1);

		expect(redisMock.recordProgress.firstCall.args).to.deep.equal([ mockedMeasurementId1, 'testid', { rawOutput: 'output' }]);
	});

	it('should mark measurement as finished if storeMeasurementResult returned record', async () => {
		const now = clock.pause().now;
		redisMock.recordResult.resolves({});

		const store = getMeasurementStore();
		await store.storeMeasurementResult({
			testId: 'testid',
			measurementId: mockedMeasurementId1,
			result: {
				status: 'finished',
				rawOutput: 'output',
			} as PingResult,
		});

		expect(redisMock.recordResult.callCount).to.equal(1);

		expect(redisMock.recordResult.args[0]).to.deep.equal([
			mockedMeasurementId1,
			'testid',
			{ status: 'finished', rawOutput: 'output' },
		]);

		expect(redisMock.markFinished.callCount).to.equal(1);
		expect(redisMock.markFinished.args[0]).to.deep.equal([ mockedMeasurementId1 ]);
		expect(redisMock.hDel.callCount).to.equal(1);
		expect(redisMock.hDel.args[0]).to.deep.equal([ 'gp:in-progress', mockedMeasurementId1 ]);
		expect(persistentRedisMock.zAdd.callCount).to.equal(1);
		expect(persistentRedisMock.zAdd.args[0]?.[0]).to.equal('gp:measurement-keys-by-date');
		expect(persistentRedisMock.zAdd.args[0]?.[1][0].value).to.equal(`gp:m:{${mockedMeasurementId1}}:results`);
		expect(persistentRedisMock.zAdd.args[0]?.[1][0].score).to.be.within(now, Date.now() * 1000 + 800);
	});

	it('should not mark measurement as finished if storeMeasurementResult didn\'t return record', async () => {
		const store = getMeasurementStore();
		await store.storeMeasurementResult({
			testId: 'testid',
			measurementId: mockedMeasurementId1,
			result: {
				status: 'finished',
				rawOutput: 'output',
			} as PingResult,
		});

		expect(redisMock.recordResult.callCount).to.equal(1);

		expect(redisMock.recordResult.args[0]).to.deep.equal([
			mockedMeasurementId1,
			'testid',
			{ status: 'finished', rawOutput: 'output' },
		]);

		expect(redisMock.markFinished.callCount).to.equal(0);
	});
});
