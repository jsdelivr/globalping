import config from 'config';
import _ from 'lodash';
import cryptoRandomString from 'crypto-random-string';
import type { OfflineProbe, Probe } from '../probe/types.js';
import { scopedLogger } from '../lib/logger.js';
import type { MeasurementRecord, MeasurementResult, MeasurementRequest, MeasurementProgressMessage, RequestType, MeasurementResultMessage } from './types.js';
import { getDefaults } from './schema/utils.js';
import { getMeasurementRedisClient, type RedisCluster } from '../lib/redis/measurement-client.js';

const logger = scopedLogger('store');

export const getMeasurementKey = (id: string, suffix: string = 'results'): string => {
	return `gp:m:{${id}}:${suffix}`;
};

const subtractObjects = (obj1: Record<string, unknown>, obj2: Record<string, unknown> = {}) => {
	const result: Record<string, unknown> = {};
	const keys1 = Object.keys(obj1);
	keys1.forEach((key) => {
		const value1 = obj1[key];
		const value2 = obj2[key];

		if (_.isPlainObject(value1) && _.isPlainObject(value2)) {
			const difference = subtractObjects(value1 as Record<string, unknown>, value2 as Record<string, unknown>);

			if (!_.isEmpty(difference)) {
				result[key] = difference;
			}
		} else if (!_.isEqual(value1, value2)) {
			result[key] = value1;
		}
	});

	return result;
};

export class MeasurementStore {
	constructor (private readonly redis: RedisCluster) {}

	async getMeasurementString (id: string): Promise<string> {
		const key = getMeasurementKey(id);
		return this.redis.sendCommand(key, true, [ 'JSON.GET', key ]);
	}

	async getMeasurement (id: string) {
		return await this.redis.json.get(getMeasurementKey(id)) as MeasurementRecord | null;
	}

	async getMeasurementIps (id: string): Promise<string[]> {
		const ips = await this.redis.json.get(getMeasurementKey(id, 'ips')) as string[] | null;
		return ips || [];
	}

	async createMeasurement (request: MeasurementRequest, onlineProbesMap: Map<number, Probe>, allProbes: (Probe | OfflineProbe)[]): Promise<string> {
		const id = cryptoRandomString({ length: 16, type: 'alphanumeric' });
		const key = getMeasurementKey(id);
		const startTime = new Date();
		const results = this.probesToResults(allProbes, request.type);

		const measurement: Partial<MeasurementRecord> = {
			id,
			type: request.type,
			status: 'in-progress',
			createdAt: startTime.toISOString(),
			updatedAt: startTime.toISOString(),
			target: request.target,
			...(request.limit && { limit: request.limit }),
			probesCount: allProbes.length,
			...(request.locations && { locations: request.locations }),
			measurementOptions: request.measurementOptions,
			results,
		};
		const measurementWithoutDefaults = this.removeDefaults(measurement, request);
		const testsToProbes = Object.fromEntries(Array.from(onlineProbesMap, ([ testId, probe ]) => [ `${id}_${testId}`, probe.uuid ]));

		await Promise.all([
			this.redis.hSet('gp:in-progress', id, startTime.getTime()),
			this.redis.set(getMeasurementKey(id, 'probes_awaiting'), onlineProbesMap.size, { EX: config.get<number>('measurement.timeout') + 30 }),
			this.redis.json.set(key, '$', measurementWithoutDefaults),
			this.redis.json.set(getMeasurementKey(id, 'ips'), '$', allProbes.map(probe => probe.ipAddress)),
			this.redis.expire(key, config.get<number>('measurement.resultTTL')),
			this.redis.expire(getMeasurementKey(id, 'ips'), config.get<number>('measurement.resultTTL')),
			!_.isEmpty(testsToProbes) && this.redis.hSet('gp:test-to-probe', testsToProbes),
			!_.isEmpty(testsToProbes) && this.redis.hExpire('gp:test-to-probe', Object.keys(testsToProbes), config.get<number>('measurement.timeout') + 120),
		]);

		return id;
	}

	async storeMeasurementProgress (data: MeasurementProgressMessage): Promise<void> {
		if (data.overwrite) {
			await this.redis.recordProgress(data.measurementId, data.testId, data.result);
		} else {
			await this.redis.recordProgressAppend(data.measurementId, data.testId, data.result);
		}
	}

	async storeMeasurementResult (data: MeasurementResultMessage) {
		const record = await this.redis.recordResult(data.measurementId, data.testId, data.result);

		if (record) {
			await this.markFinished(data.measurementId);
		}

		return record;
	}

	async markFinished (id: string) {
		await Promise.all([
			this.redis.markFinished(id),
			this.redis.hDel('gp:in-progress', id),
		]);
	}

	async markFinishedByTimeout (ids: string[]): Promise<void> {
		if (ids.length === 0) {
			return;
		}

		const keys = ids.map(id => getMeasurementKey(id));
		const measurements = await this.redis.json.mGet(keys, '.') as Array<MeasurementRecord | null>;
		const existingMeasurements = measurements.filter((measurement): measurement is MeasurementRecord => Boolean(measurement));

		for (const measurement of existingMeasurements) {
			measurement.status = 'finished';
			measurement.updatedAt = new Date().toISOString();
			const inProgressResults = Object.values(measurement.results).filter(resultObject => resultObject.result.status === 'in-progress');

			for (const resultObject of inProgressResults) {
				resultObject.result.status = 'failed';
				resultObject.result.rawOutput += '\n\nThe measurement timed out.';
			}
		}

		const updateMeasurementPromises = existingMeasurements.map(measurement => this.redis.json.set(getMeasurementKey(measurement.id), '$', measurement));

		await Promise.all([
			this.redis.hDel('gp:in-progress', ids),
			...ids.map(id => this.redis.del((getMeasurementKey(id, 'probes_awaiting')))),
			...updateMeasurementPromises,
		]);
	}

	async cleanup () {
		const SCAN_BATCH_SIZE = 5000;
		const timeoutTime = config.get<number>('measurement.timeout') * 1000;
		const { cursor, tuples } = await this.redis.hScan('gp:in-progress', 0, { COUNT: SCAN_BATCH_SIZE });

		if (cursor !== 0) {
			logger.warn(`There are more than ${SCAN_BATCH_SIZE} "in-progress" elements in db`);
		}

		const timedOutIds = tuples
			.filter(({ value: time }) => Date.now() - Number(time) >= timeoutTime)
			.map(({ field: id }) => id);

		await this.markFinishedByTimeout(timedOutIds);
	}

	scheduleCleanup () {
		const SCAN_INTERVAL_TIME = 15_000;
		const intervalTime = Math.round(Math.random() * SCAN_INTERVAL_TIME);

		setTimeout(() => {
			this.cleanup()
				.finally(() => this.scheduleCleanup())
				.catch(error => logger.error('Error in MeasurementStore.cleanup()', error));
		}, intervalTime).unref();
	}

	removeDefaults (measurement: Partial<MeasurementRecord>, request: MeasurementRequest): Partial<MeasurementRecord> {
		const defaults = getDefaults(request);

		// Removes `"limit": 1` from locations. E.g. [{"country": "US", "limit": 1}] => [{"country": "US"}]
		if (_.isArray(measurement.locations)) {
			measurement.locations = measurement.locations.map(location => location.limit === 1 ? _.omit(location, 'limit') : location);
		}

		return subtractObjects(measurement, defaults) as Partial<MeasurementRecord>;
	}

	probesToResults (probes: (Probe | OfflineProbe)[], type: RequestType) {
		const results = probes.map(probe => ({
			probe: {
				continent: probe.location.continent,
				region: probe.location.region,
				country: probe.location.country,
				state: probe.location.state ?? null,
				city: probe.location.city,
				asn: probe.location.asn,
				longitude: probe.location.longitude,
				latitude: probe.location.latitude,
				network: probe.location.network,
				tags: probe.tags.map(({ value }) => value),
				resolvers: probe.resolvers,
			},
			result: this.getInitialResult(type, probe.status),
		} as MeasurementResult));

		return results;
	}

	getInitialResult (type: RequestType, status: Probe['status'] | OfflineProbe['status']) {
		if (status === 'offline') {
			return {
				status: 'offline',
				rawOutput: 'This probe is currently offline. Please try again later.',
			};
		}

		if (type === 'http') {
			return {
				status: 'in-progress',
				rawHeaders: '',
				rawBody: '',
				rawOutput: '',
			};
		}

		return {
			status: 'in-progress',
			rawOutput: '',
		};
	}
}

let store: MeasurementStore;

export const getMeasurementStore = () => {
	if (!store) {
		store = new MeasurementStore(getMeasurementRedisClient());
		store.scheduleCleanup();
	}

	return store;
};
