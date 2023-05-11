import config from 'config';
import _ from 'lodash';
import cryptoRandomString from 'crypto-random-string';
import type { Probe } from '../probe/types.js';
import type { RedisClient } from '../lib/redis/client.js';
import { getRedisClient } from '../lib/redis/client.js';
import { scopedLogger } from '../lib/logger.js';
import type { MeasurementRecord, MeasurementResultMessage, MeasurementResult, MeasurementRequest, MeasurementProgressMessage } from './types.js';
import { getDefaults } from './schema/utils.js';

const logger = scopedLogger('store');

export const getMeasurementKey = (id: string, suffix: 'probes_awaiting' | undefined = undefined): string => {
	let key = `gp:measurement:${id}`;

	if (suffix) {
		key += `:${suffix}`;
	}

	return key;
};

const substractObjects = (obj1: Record<string, unknown>, obj2: Record<string, unknown> = {}) => {
	const result: Record<string, unknown> = {};
	const keys1 = Object.keys(obj1);
	keys1.forEach((key) => {
		const value1 = obj1[key];
		const value2 = obj2[key];

		if (_.isPlainObject(value1)) {
			const difference = substractObjects(value1 as Record<string, unknown>, value2 as Record<string, unknown>);

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
	constructor (private readonly redis: RedisClient) {}

	async getMeasurementResults (id: string): Promise<string> {
		return this.redis.sendCommand([ 'JSON.GET', getMeasurementKey(id) ]);
	}

	async createMeasurement (request: MeasurementRequest, probes: Probe[]): Promise<string> {
		const id = cryptoRandomString({ length: 16, type: 'alphanumeric' });
		const key = getMeasurementKey(id);

		const results = this.probesToResults(probes, request.type);
		const probesAwaitingTtl = config.get<number>('measurement.timeout') + 5;
		const startTime = new Date();
		let measurement: MeasurementRecord = {
			id,
			type: request.type,
			status: 'in-progress',
			createdAt: startTime.toISOString(),
			updatedAt: startTime.toISOString(),
			target: request.target,
			limit: request.limit,
			probesCount: probes.length,
			locations: request.locations,
			measurementOptions: request.measurementOptions,
			results,
		};
		const defaults = getDefaults(request);
		measurement = substractObjects(measurement, defaults) as MeasurementRecord;

		await Promise.all([
			this.redis.hSet('gp:in-progress', id, startTime.getTime()),
			this.redis.set(getMeasurementKey(id, 'probes_awaiting'), probes.length, { EX: probesAwaitingTtl }),
			this.redis.json.set(key, '$', measurement),
			this.redis.expire(key, config.get<number>('measurement.resultTTL')),
		]);

		return id;
	}

	async storeMeasurementProgress (data: MeasurementProgressMessage): Promise<void> {
		const key = getMeasurementKey(data.measurementId);
		const entries = Object.entries(data.result);
		let progressUpdatePromises;

		if (data.overwrite) {
			progressUpdatePromises = entries.map(([ field, value ]) => this.redis.json.set(key, `$.results[${data.testId}].result.${field}`, value));
		} else {
			progressUpdatePromises = entries.map(([ field, value ]) => this.redis.json.strAppend(key, `$.results[${data.testId}].result.${field}`, value));
		}

		await Promise.all([
			...progressUpdatePromises,
			this.redis.json.set(key, '$.updatedAt', new Date().toISOString()),
		]);
	}

	async storeMeasurementResult (data: MeasurementResultMessage): Promise<number> {
		const key = getMeasurementKey(data.measurementId);

		const [ remainingProbes ] = await Promise.all([
			this.redis.decr(`${key}:probes_awaiting`),
			this.redis.json.set(key, `$.results[${data.testId}].result`, data.result),
			this.redis.json.set(key, '$.updatedAt', new Date().toISOString()),
		]);

		return remainingProbes;
	}

	async markFinished (id: string): Promise<void> {
		const key = getMeasurementKey(id);

		await Promise.all([
			this.redis.hDel('gp:in-progress', id),
			this.redis.del(`${key}:probes_awaiting`),
			this.redis.json.set(key, '$.status', 'finished'),
			this.redis.json.set(key, '$.updatedAt', new Date().toISOString()),
		]);
	}

	async markFinishedByTimeout (ids: string[]): Promise<void> {
		if (ids.length === 0) {
			return;
		}

		const keys = ids.map(id => getMeasurementKey(id));
		// eslint-disable-next-line @typescript-eslint/ban-types
		const measurements = await this.redis.json.mGet(keys, '.') as Array<MeasurementRecord | null>;
		const existingMeasurements = measurements.filter((measurement): measurement is MeasurementRecord => Boolean(measurement));

		for (const measurement of existingMeasurements) {
			measurement.status = 'finished';
			measurement.updatedAt = new Date().toISOString();
			const inProgressResults = Object.values(measurement.results).filter(resultObject => resultObject.result.status === 'in-progress');

			for (const resultObject of inProgressResults) {
				resultObject.result.status = 'failed';
				resultObject.result.rawOutput += '\n\nThe measurement timed out';
			}
		}

		const updateMeasurementPromises = existingMeasurements.map(measurement => this.redis.json.set(getMeasurementKey(measurement.id), '$', measurement));

		await Promise.all([
			this.redis.hDel('gp:in-progress', ids),
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
				.catch(error => logger.error(error));
		}, intervalTime);
	}

	probesToResults (probes: Probe[], type: string) {
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
			result: this.getInitialResult(type),
		} as MeasurementResult));

		return results;
	}

	getInitialResult (type: string) {
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
		store = new MeasurementStore(getRedisClient());
		store.scheduleCleanup();
	}

	return store;
};
