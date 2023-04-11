import config from 'config';
import cryptoRandomString from 'crypto-random-string';
import type { Probe } from '../probe/types.js';
import type { RedisClient } from '../lib/redis/client.js';
import { getRedisClient } from '../lib/redis/client.js';
import { scopedLogger } from '../lib/logger.js';
import type { MeasurementRecord, MeasurementResultMessage, MeasurementResult } from './types.js';

const logger = scopedLogger('store');

export const getMeasurementKey = (id: string, suffix: 'probes_awaiting' | undefined = undefined): string => {
	let key = `gp:measurement:${id}`;

	if (suffix) {
		key += `:${suffix}`;
	}

	return key;
};

export class MeasurementStore {
	constructor (private readonly redis: RedisClient) {}

	async getMeasurementResults (id: string): Promise<MeasurementRecord> {
		return await this.redis.json.get(getMeasurementKey(id)) as MeasurementRecord;
	}

	async createMeasurement (type: string, probes: Probe[]): Promise<string> {
		const id = cryptoRandomString({ length: 16, type: 'alphanumeric' });
		const key = getMeasurementKey(id);

		const results = this.probesToResults(probes);
		const probesAwaitingTtl = config.get<number>('measurement.timeout') + 5;
		const startTime = Date.now();

		await Promise.all([
			this.redis.hSet('gp:in-progress', id, startTime),
			this.redis.set(getMeasurementKey(id, 'probes_awaiting'), probes.length, { EX: probesAwaitingTtl }),
			this.redis.json.set(key, '$', {
				id,
				type,
				status: 'in-progress',
				createdAt: startTime,
				updatedAt: startTime,
				probesCount: probes.length,
				results,
			}),
			this.redis.expire(key, config.get<number>('measurement.resultTTL')),
		]);

		return id;
	}

	async storeMeasurementProgress (data: MeasurementResultMessage): Promise<void> {
		const key = getMeasurementKey(data.measurementId);

		await Promise.all([
			data.overwrite
				? this.redis.json.set(key, `$.results[${data.testId}].result.rawOutput`, data.result.rawOutput)
				: this.redis.json.strAppend(key, `$.results[${data.testId}].result.rawOutput`, data.result.rawOutput),

			this.redis.json.set(key, '$.updatedAt', Date.now()),
		]);
	}

	async storeMeasurementResult (data: MeasurementResultMessage): Promise<number> {
		const key = getMeasurementKey(data.measurementId);

		const [ remainingProbes ] = await Promise.all([
			this.redis.decr(`${key}:probes_awaiting`),
			this.redis.json.set(key, `$.results[${data.testId}].result`, data.result),
			this.redis.json.set(key, '$.updatedAt', Date.now()),
		]);

		return remainingProbes;
	}

	async markFinished (id: string): Promise<void> {
		const key = getMeasurementKey(id);

		await Promise.all([
			this.redis.hDel('gp:in-progress', id),
			this.redis.del(`${key}:probes_awaiting`),
			this.redis.json.set(key, '$.status', 'finished'),
			this.redis.json.set(key, '$.updatedAt', Date.now()),
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
			measurement.updatedAt = Date.now();
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

	probesToResults (probes: Probe[]) {
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
			result: {
				status: 'in-progress',
				rawOutput: '',
			},
		} as MeasurementResult));

		return results;
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
