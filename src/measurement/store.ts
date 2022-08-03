import config from 'config';
import cryptoRandomString from 'crypto-random-string';
import type {Probe} from '../probe/types.js';
import type {RedisClient} from '../lib/redis/client.js';
import {getRedisClient} from '../lib/redis/client.js';
import type {MeasurementRecord, MeasurementResultMessage, NetworkTest} from './types.js';

export const getMeasurementKey = (id: string, suffix: 'probes_awaiting' | undefined = undefined): string => {
	let key = `gp:measurement:${id}`;

	if (suffix) {
		key += `:${suffix}`;
	}

	return key;
};

export class MeasurementStore {
	constructor(private readonly redis: RedisClient) {}

	async getMeasurementResults(id: string): Promise<MeasurementRecord> {
		const result = await this.redis.call('JSON.GET', getMeasurementKey(id)) as string;
		return JSON.parse(result) as MeasurementRecord;
	}

	async createMeasurement(test: NetworkTest, probesCount: number): Promise<string> {
		const id = cryptoRandomString({length: 16, type: 'alphanumeric'});
		const key = getMeasurementKey(id);

		const probesAwaitingTtl = config.get<number>('measurement.timeout') + 5;

		await Promise.all([
			await this.redis.set(getMeasurementKey(id, 'probes_awaiting'), probesCount, 'EX', probesAwaitingTtl),
			await this.redis.call('JSON.SET', key, '$', JSON.stringify({
				id,
				type: test.type,
				status: 'in-progress',
				createdAt: Date.now(),
				updatedAt: Date.now(),
				probesCount,
				results: {},
			})),
		]);

		// You cant set expire on non-existing record
		await this.redis.expire(key, config.get<number>('measurement.resultTTL'));

		return id;
	}

	async storeMeasurementProbe(measurementId: string, probeId: string, probe: Probe): Promise<void> {
		const key = getMeasurementKey(measurementId);
		await Promise.all([
			this.redis.call('JSON.SET', key, `$.results.${probeId}`, JSON.stringify({
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
					resolvers: probe.resolvers,
				},
				result: {rawOutput: ''},
			})),
			this.redis.call('JSON.SET', key, '$.updatedAt', Date.now()),
		]);
	}

	async storeMeasurementProgress(data: MeasurementResultMessage): Promise<void> {
		const key = getMeasurementKey(data.measurementId);

		const rawOutputCmd = data.overwrite ? 'JSON.SET' : 'JSON.STRAPPEND';

		await Promise.all([
			this.redis.call(rawOutputCmd, key, `$.results.${data.testId}.result.rawOutput`, JSON.stringify(data.result.rawOutput)),
			this.redis.call('JSON.SET', key, '$.updatedAt', Date.now()),
		]);
	}

	async storeMeasurementResult(data: MeasurementResultMessage): Promise<void> {
		const key = getMeasurementKey(data.measurementId);

		await Promise.all([
			this.redis.call('JSON.SET', key, `$.results.${data.testId}.result`, JSON.stringify(data.result)),
			this.redis.call('JSON.SET', key, '$.updatedAt', Date.now()),
			this.redis.decr(`${key}:probes_awaiting`),
		]);
	}

	async markFinished(id: string): Promise<void> {
		const key = getMeasurementKey(id);

		await Promise.all([
			this.redis.call('JSON.SET', key, '$.status', JSON.stringify('finished')),
			this.redis.call('JSON.SET', key, '$.updatedAt', Date.now()),
		]);
	}
}

let store: MeasurementStore;

export const getMeasurementStore = () => {
	if (!store) {
		store = new MeasurementStore(getRedisClient());
	}

	return store;
};
