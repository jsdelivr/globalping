import { promisify } from 'node:util';
import { brotliCompress as brotliCompressCallback } from 'node:zlib';
import * as td from 'testdouble';
import { expect } from 'chai';
import * as sinon from 'sinon';
import relativeDayUtc from 'relative-day-utc';
import { commandOptions } from 'redis';
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

const buildMinimalMeasurement = (measurementId: string, additionalProps = {}) => ({
	id: measurementId,
	type: 'ping' as const,
	status: 'finished' as const,
	createdAt: '2024-01-01T00:00:00.000Z',
	updatedAt: '2024-01-01T00:00:00.000Z',
	target: 'example.com',
	probesCount: 0,
	results: [],
	...additionalProps,
});

const buildMinimalMeasurementString = (measurementId: string, additionalProps = {}) => JSON.stringify(buildMinimalMeasurement(measurementId, additionalProps));

describe('measurement store', () => {
	const brotliCompress = promisify(brotliCompressCallback);
	let getMeasurementStore: () => MeasurementStore;

	const sandbox = sinon.createSandbox();
	const enqueueForOffloadStub = sandbox.stub();
	const redisMock = {
		compressedJsonCompress: sandbox.stub(),
		compressedJsonGet: sandbox.stub(),
		compressedJsonGetBuffer: sandbox.stub(),
		compressedJsonGetBufferCompressed: sandbox.stub(),
		hScan: sandbox.stub(),
		hDel: sandbox.stub(),
		hSet: sandbox.stub(),
		hExpire: sandbox.stub(),
		set: sandbox.stub(),
		expire: sandbox.stub(),
		del: sandbox.stub(),
		sendCommand: sandbox.stub(),
		json: {
			get: sandbox.stub(),
			set: sandbox.stub(),
		},
		recordProgress: sandbox.stub(),
		recordProgressAppend: sandbox.stub(),
		recordResult: sandbox.stub(),
		markFinished: sandbox.stub(),
		markFinishedByTimeout: sandbox.stub(),
	};

	const mockedMeasurementId1 = '2E2SZgEwA6W6HvzlT0001z9VK';
	const mockedMeasurementId2 = '2F2SZgEwA6W6HvzlT0001z9VK';
	const mockedMeasurementId3 = '2G2SZgEwA6W6HvzlT0001z9VK';

	sandbox.stub(Math, 'random').returns(0.8);

	const parseMeasurementIdStub = sandbox.stub();
	const offloaderGetMeasurementBufferCompressedStub = sandbox.stub();

	before(async () => {
		await td.replaceEsm('../../../../src/measurement/id.ts', {
			...id,
			generateMeasurementId: () => mockedMeasurementId1,
			parseMeasurementId: ((...args: any[]) => parseMeasurementIdStub(...args)) as unknown,
		}, {});

		await td.replaceEsm('../../../../src/lib/redis/measurement-client.ts', { getMeasurementRedisClient: () => redisMock });

		class OffloaderMock {
			startRetryWorker () { /* no-op */ }
			enqueueForOffload (record: unknown) {
				enqueueForOffloadStub(record);
			}

			getMeasurementBufferCompressed (id: string, userTier: number, createdAtRounded: number) {
				return offloaderGetMeasurementBufferCompressedStub(id, userTier, createdAtRounded);
			}
		}

		await td.replaceEsm('../../../../src/measurement/store-offloader.ts', { MeasurementStoreOffloader: OffloaderMock });
		getMeasurementStore = (await import('../../../../src/measurement/store.js')).getMeasurementStore;
	});

	beforeEach(() => {
		parseMeasurementIdStub.callsFake(id.parseMeasurementId);
		redisMock.compressedJsonCompress.reset();
		redisMock.compressedJsonGet.reset();
		redisMock.compressedJsonGetBuffer.reset();
		redisMock.compressedJsonGetBufferCompressed.reset();
		redisMock.recordResult.reset();
		redisMock.markFinishedByTimeout.reset();
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
		const finishedRecord = {
			id: mockedMeasurementId1,
			type: 'ping',
			status: 'finished',
			createdAt: new Date(now).toISOString(),
			updatedAt: new Date(now + 1_000).toISOString(),
			probesCount: 1,
			results: [{
				probe: {},
				result: {
					status: 'failed',
					rawOutput: '\n\nThe measurement timed out.',
				},
			}],
		};

		redisMock.hScan.resolves({
			cursor: 0,
			tuples: [
				{ field: mockedMeasurementId1, value: relativeDayUtc(-1).valueOf() }, // Timed out measurement
				{ field: mockedMeasurementId2, value: relativeDayUtc(-1).valueOf() }, // Non-existing measurement
				{ field: mockedMeasurementId3, value: relativeDayUtc(1).valueOf() }, // Not timed out measurement
			],
		});

		redisMock.markFinishedByTimeout.onFirstCall().resolves(Buffer.concat([
			Buffer.from([ 0x00 ]),
			Buffer.from(JSON.stringify(finishedRecord)),
		]));

		redisMock.markFinishedByTimeout.onSecondCall().resolves(null);

		getMeasurementStore();

		await clock.tickAsyncStepped(16_000);

		expect(redisMock.hScan.callCount).to.equal(1);
		expect(redisMock.hScan.firstCall.args).to.deep.equal([ 'gp:in-progress', 0, { COUNT: 5000 }]);
		expect(redisMock.markFinishedByTimeout.callCount).to.equal(2);
		expect(redisMock.markFinishedByTimeout.firstCall.args).to.deep.equal([ commandOptions({ returnBuffers: true }), mockedMeasurementId1 ]);
		expect(redisMock.markFinishedByTimeout.secondCall.args).to.deep.equal([ commandOptions({ returnBuffers: true }), mockedMeasurementId2 ]);
		expect(redisMock.hDel.callCount).to.equal(1);
		expect(redisMock.hDel.firstCall.args).to.deep.equal([ 'gp:in-progress', [ mockedMeasurementId1, mockedMeasurementId2 ] ]);
		expect(redisMock.del.callCount).to.equal(0);
		expect(redisMock.json.set.callCount).to.equal(0);
		expect(redisMock.compressedJsonCompress.callCount).to.equal(0);

		expect(enqueueForOffloadStub.callCount).to.equal(1);
		expect(enqueueForOffloadStub.firstCall.args).to.deep.equal([ finishedRecord ]);
	});

	it('should not offload when timeout cleanup loses to a normal finish', async () => {
		redisMock.hScan.resolves({
			cursor: 0,
			tuples: [
				{ field: mockedMeasurementId1, value: relativeDayUtc(-1).valueOf() },
			],
		});

		redisMock.markFinishedByTimeout.resolves(null);

		getMeasurementStore();

		await clock.tickAsyncStepped(16_000);

		expect(redisMock.hScan.callCount).to.equal(1);
		expect(redisMock.markFinishedByTimeout.callCount).to.equal(1);
		expect(redisMock.markFinishedByTimeout.firstCall.args).to.deep.equal([ commandOptions({ returnBuffers: true }), mockedMeasurementId1 ]);
		expect(redisMock.hDel.callCount).to.equal(1);
		expect(redisMock.hDel.firstCall.args).to.deep.equal([ 'gp:in-progress', [ mockedMeasurementId1 ] ]);
		expect(enqueueForOffloadStub.callCount).to.equal(0);
	});

	it('should read compressed measurement results for the offloader batch path', async () => {
		const store = getMeasurementStore();
		redisMock.compressedJsonGet
			.onFirstCall().resolves({ id: 'A', status: 'finished' })
			.onSecondCall().resolves(null)
			.onThirdCall().resolves({ id: 'C', status: 'finished' });

		const records = await store.getMeasurementsForOffloader([ 'A', 'B', 'C' ]);

		expect(records).to.deep.equal([
			{ id: 'A', status: 'finished' },
			null,
			{ id: 'C', status: 'finished' },
		]);

		expect(redisMock.compressedJsonGet.callCount).to.equal(3);
		expect(redisMock.compressedJsonGet.firstCall.args).to.deep.equal([ 'gp:m:{A}:results' ]);
		expect(redisMock.compressedJsonGet.secondCall.args).to.deep.equal([ 'gp:m:{B}:results' ]);
		expect(redisMock.compressedJsonGet.thirdCall.args).to.deep.equal([ 'gp:m:{C}:results' ]);
		expect(redisMock.json.get.callCount).to.equal(0);
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
		expect(redisMock.json.set.callCount).to.equal(3);

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

		expect(redisMock.json.set.args).to.deep.include([ `gp:m:{${mockedMeasurementId1}}:meta`, '$', {}]);

		expect(redisMock.json.set.args).to.deep.include([ `gp:m:{${mockedMeasurementId1}}:ips`, '$', [ '1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4' ] ]);

		expect(redisMock.expire.args).to.deep.include([ `gp:m:{${mockedMeasurementId1}}:meta`, 604800 ]);

		expect(redisMock.expire.args).to.deep.include([ `gp:m:{${mockedMeasurementId1}}:ips`, 604800 ]);

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
		redisMock.recordResult.resolves({});
		const finishedRecord = {
			id: mockedMeasurementId1,
			type: 'ping',
			status: 'finished',
			results: [],
		};
		redisMock.markFinished.resolves(Buffer.concat([
			Buffer.from([ 0x00 ]),
			Buffer.from(JSON.stringify(finishedRecord)),
		]));

		const store = getMeasurementStore();
		const record = await store.storeMeasurementResult({
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

		expect(record).to.deep.equal(finishedRecord);

		expect(redisMock.markFinished.callCount).to.equal(1);
		expect(redisMock.markFinished.args[0]).to.deep.equal([ commandOptions({ returnBuffers: true }), mockedMeasurementId1 ]);
		expect(redisMock.hDel.callCount).to.equal(1);
		expect(redisMock.hDel.args[0]).to.deep.equal([ 'gp:in-progress', mockedMeasurementId1 ]);
		expect(enqueueForOffloadStub.callCount).to.equal(1);
		expect(enqueueForOffloadStub.firstCall.args).to.deep.equal([ finishedRecord ]);
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

	it('getMeasurementBufferCompressed should prefer the offload DB for likely offloaded measurements', async () => {
		const store = getMeasurementStore();
		const nowMs = Date.now();
		const minutesOld = 45;
		const minutesSinceEpoch = Math.floor((nowMs - minutesOld * 60_000) / 60_000);

		parseMeasurementIdStub.returns({ minutesSinceEpoch, userTier: 0 });
		offloaderGetMeasurementBufferCompressedStub.resolves(await brotliCompress(Buffer.from('{"from":"db"}')));
		redisMock.compressedJsonGetBufferCompressed.resolves(null);

		const result = await store.getMeasurementBufferCompressed('SOME_ID');
		expect(result).to.deep.equal(await brotliCompress(Buffer.from('{"from":"db"}')));

		expect(offloaderGetMeasurementBufferCompressedStub.callCount).to.equal(1);
		expect(redisMock.compressedJsonGetBufferCompressed.callCount).to.equal(0);
	});

	it('getMeasurementBufferCompressed should fallback to Redis if the offload DB returns null (miss)', async () => {
		const store = getMeasurementStore();
		const nowMs = Date.now();
		const minutesOld = 45;
		const minutesSinceEpoch = Math.floor((nowMs - minutesOld * 60_000) / 60_000);

		parseMeasurementIdStub.returns({ minutesSinceEpoch, userTier: 0 });
		offloaderGetMeasurementBufferCompressedStub.resolves(null);

		const redisValue = '{"from":"redis"}';
		redisMock.compressedJsonGetBufferCompressed.resolves(await brotliCompress(Buffer.from(redisValue)));

		const result = await store.getMeasurementBufferCompressed('SOME_ID');
		expect(result).to.deep.equal(await brotliCompress(Buffer.from(redisValue)));

		expect(offloaderGetMeasurementBufferCompressedStub.callCount).to.equal(1);
		expect(redisMock.compressedJsonGetBufferCompressed.callCount).to.equal(1);
		expect(redisMock.compressedJsonGetBufferCompressed.firstCall.args).to.deep.equal([ 'gp:m:{SOME_ID}:results' ]);
	});

	it('getMeasurementBufferCompressed should fallback to Redis if DB throws', async () => {
		const store = getMeasurementStore();
		const nowMs = Date.now();
		const minutesOld = 45;
		const minutesSinceEpoch = Math.floor((nowMs - minutesOld * 60_000) / 60_000);

		parseMeasurementIdStub.returns({ minutesSinceEpoch, userTier: 0 });
		offloaderGetMeasurementBufferCompressedStub.rejects(new Error('DB error'));

		const redisValue = '{"from":"redis"}';
		redisMock.compressedJsonGetBufferCompressed.resolves(await brotliCompress(Buffer.from(redisValue)));

		const result = await store.getMeasurementBufferCompressed('SOME_ID');
		expect(result).to.deep.equal(await brotliCompress(Buffer.from(redisValue)));

		expect(offloaderGetMeasurementBufferCompressedStub.callCount).to.equal(1);
		expect(redisMock.compressedJsonGetBufferCompressed.callCount).to.equal(1);
	});

	it('getMeasurementBufferCompressed should use Redis when measurement is recent', async () => {
		const store = getMeasurementStore();
		const nowMs = Date.now();
		const minutesOld = 5;
		const minutesSinceEpoch = Math.floor((nowMs - minutesOld * 60_000) / 60_000);

		parseMeasurementIdStub.returns({ minutesSinceEpoch, userTier: 0 });
		offloaderGetMeasurementBufferCompressedStub.resolves(await brotliCompress(Buffer.from(buildMinimalMeasurementString('SOME_ID', { from: 'db' }))));

		const redisValue = buildMinimalMeasurementString('SOME_ID', { from: 'redis' });
		redisMock.compressedJsonGetBufferCompressed.resolves(await brotliCompress(Buffer.from(redisValue)));

		const result = await store.getMeasurementBufferCompressed('SOME_ID');
		expect(result).to.deep.equal(await brotliCompress(Buffer.from(redisValue)));
		expect(offloaderGetMeasurementBufferCompressedStub.callCount).to.equal(0);
		expect(redisMock.compressedJsonGetBufferCompressed.callCount).to.equal(1);
		expect(redisMock.compressedJsonGetBufferCompressed.firstCall.args).to.deep.equal([ 'gp:m:{SOME_ID}:results' ]);
	});

	it('getMeasurement should prefer the offload DB for likely offloaded measurements', async () => {
		const store = getMeasurementStore();
		const nowMs = Date.now();
		const minutesOld = 45;
		const minutesSinceEpoch = Math.floor((nowMs - minutesOld * 60_000) / 60_000);

		parseMeasurementIdStub.returns({ minutesSinceEpoch, userTier: 0 });
		offloaderGetMeasurementBufferCompressedStub.resolves(await brotliCompress(Buffer.from(buildMinimalMeasurementString('SOME_ID', { from: 'db' }))));
		redisMock.compressedJsonGetBufferCompressed.reset();

		const result = await store.getMeasurement('SOME_ID');
		expect(result).to.deep.equal(buildMinimalMeasurement('SOME_ID', { from: 'db' }));

		expect(offloaderGetMeasurementBufferCompressedStub.callCount).to.equal(1);
		expect(redisMock.compressedJsonGetBufferCompressed.callCount).to.equal(0);
	});

	it('getMeasurement should fallback to Redis if the offload DB returns null', async () => {
		const store = getMeasurementStore();
		const nowMs = Date.now();
		const minutesOld = 45;
		const minutesSinceEpoch = Math.floor((nowMs - minutesOld * 60_000) / 60_000);

		parseMeasurementIdStub.returns({ minutesSinceEpoch, userTier: 0 });
		offloaderGetMeasurementBufferCompressedStub.resolves(null);
		redisMock.compressedJsonGetBufferCompressed.reset();
		redisMock.compressedJsonGetBufferCompressed.resolves(await brotliCompress(Buffer.from(buildMinimalMeasurement('SOME_ID', { from: 'redis' }))));

		const result = await store.getMeasurement('SOME_ID');
		expect(result).to.deep.equal(buildMinimalMeasurement('SOME_ID', { from: 'redis' }));

		expect(offloaderGetMeasurementBufferCompressedStub.callCount).to.equal(1);
		expect(redisMock.compressedJsonGetBufferCompressed.callCount).to.equal(1);
	});

	it('getMeasurement should fallback to Redis if DB throws', async () => {
		const store = getMeasurementStore();
		const nowMs = Date.now();
		const minutesOld = 45;
		const minutesSinceEpoch = Math.floor((nowMs - minutesOld * 60_000) / 60_000);

		parseMeasurementIdStub.returns({ minutesSinceEpoch, userTier: 0 });
		offloaderGetMeasurementBufferCompressedStub.rejects(new Error('DB error'));
		redisMock.compressedJsonGetBufferCompressed.reset();
		redisMock.compressedJsonGetBufferCompressed.resolves(await brotliCompress(Buffer.from('buildMinimalMeasurement('SOME_ID', { from: 'redis' })')));

		const result = await store.getMeasurement('SOME_ID');
		expect(result).to.deep.equal(buildMinimalMeasurement('SOME_ID', { from: 'redis' }));

		expect(offloaderGetMeasurementBufferCompressedStub.callCount).to.equal(1);
		expect(redisMock.compressedJsonGetBufferCompressed.callCount).to.equal(1);
	});

	it('getMeasurement should use Redis when measurement is recent', async () => {
		const store = getMeasurementStore();
		const nowMs = Date.now();
		const minutesOld = 5;
		const minutesSinceEpoch = Math.floor((nowMs - minutesOld * 60_000) / 60_000);

		parseMeasurementIdStub.returns({ minutesSinceEpoch, userTier: 0 });
		redisMock.compressedJsonGetBufferCompressed.reset();
		redisMock.compressedJsonGetBufferCompressed.resolves(await brotliCompress(Buffer.from(buildMinimalMeasurement('SOME_ID', { from: 'redis' }))));

		const result = await store.getMeasurement('SOME_ID');
		expect(result).to.deep.equal(buildMinimalMeasurement('SOME_ID', { from: 'redis' }));

		expect(offloaderGetMeasurementBufferCompressedStub.callCount).to.equal(0);
		expect(redisMock.compressedJsonGetBufferCompressed.callCount).to.equal(1);
	});

	it('setOffloadedExpiration should set 60m TTL on results keys', async () => {
		const store = getMeasurementStore();
		redisMock.expire.resetHistory();
		await store.setOffloadedExpiration([ 'A', 'B' ]);
		expect(redisMock.expire.callCount).to.equal(2);
		expect(redisMock.expire.firstCall.args).to.deep.equal([ 'gp:m:{A}:results', 3600 ]);
		expect(redisMock.expire.secondCall.args).to.deep.equal([ 'gp:m:{B}:results', 3600 ]);
	});
});
