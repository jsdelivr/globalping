import is from '@sindresorhus/is';
import Bluebird from 'bluebird';
import config from 'config';
import _ from 'lodash';

import type { OfflineProbe, ServerProbe } from '../probe/types.js';
import { scopedLogger } from '../lib/logger.js';
import type {
	MeasurementProgressMessage,
	MeasurementRecord,
	MeasurementRequest,
	MeasurementResult,
	MeasurementResultMessage,
	RequestType,
} from './types.js';
import { getDefaults } from './schema/utils.js';
import { getMeasurementRedisClient, type RedisCluster } from '../lib/redis/measurement-client.js';
import { AuthenticateStateUser } from '../lib/http/middleware/authenticate.js';
import { generateMeasurementId, parseMeasurementId } from './id.js';
import { MeasurementStoreOffloader } from './store-offloader.js';
import { measurementStoreClient } from '../lib/sql/client.js';
import type { ExportMeta } from './types.js';

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
	private offloader: MeasurementStoreOffloader;

	constructor (private readonly redis: RedisCluster) {
		this.offloader = new MeasurementStoreOffloader(measurementStoreClient, this);
	}

	async getMeasurementString (id: string): Promise<string | null> {
		return this.getFromRedisOrOffloader(id, key => this.redis.sendCommand(key, true, [ 'JSON.GET', key ]));
	}

	async getMeasurement (id: string): Promise<MeasurementRecord | null> {
		return this.getFromRedisOrOffloader(
			id,
			key => this.redis.json.get(key) as Promise<MeasurementRecord | null>,
			s => JSON.parse(s) as MeasurementRecord,
		);
	}

	private async getFromRedisOrOffloader<T extends string | MeasurementRecord> (
		id: string,
		fromRedis: (key: string) => Promise<T | null>,
		parseOffloaded?: (s: string) => T,
	): Promise<T | null> {
		let userTier;
		let minutesSinceEpoch;

		try {
			({ minutesSinceEpoch, userTier } = parseMeasurementId(id));
		} catch {
			return null;
		}

		const createdAtMs = minutesSinceEpoch * 60_000;
		const isOlderThan30m = Date.now() - createdAtMs > 30 * 60_000;

		if (isOlderThan30m) {
			try {
				const offloaded = await this.offloader.getMeasurementString(id, userTier, createdAtMs);

				if (offloaded) {
					return parseOffloaded ? parseOffloaded(offloaded) : offloaded as T;
				}
			} catch {
				// Fall back to Redis.
			}
		}

		return fromRedis(getMeasurementKey(id));
	}

	async getMeasurements (ids: string[]): Promise<(MeasurementRecord | null)[]> {
		return Bluebird.map(ids, id => this.redis.json.get(getMeasurementKey(id)) as Promise<MeasurementRecord | null>, { concurrency: 8 });
	}

	async getMeasurementIps (id: string): Promise<string[]> {
		const ips = await this.redis.json.get(getMeasurementKey(id, 'ips')) as string[] | null;
		return ips || [];
	}

	async getMeasurementMetas (ids: string[]): Promise<Array<ExportMeta | null>> {
		return Bluebird.map(ids, id => this.redis.json.get(getMeasurementKey(id, 'meta')) as Promise<ExportMeta | null>, { concurrency: 8 });
	}

	async createMeasurement (request: MeasurementRequest, onlineProbesMap: Map<number, ServerProbe>, allProbes: (ServerProbe | OfflineProbe)[], userType?: AuthenticateStateUser['userType'], exportMeta: ExportMeta = {}): Promise<string> {
		const startTime = new Date();
		const results = this.probesToResults(allProbes, request.type);
		const id = generateMeasurementId(startTime, userType);
		const key = getMeasurementKey(id);

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
			...(request.scheduleId && { scheduleId: request.scheduleId }),
			...(request.configurationId && { configurationId: request.configurationId }),
			results,
		};
		const measurementWithoutDefaults = this.removeDefaults(measurement, request);
		const testsToProbes = Object.fromEntries(Array.from(onlineProbesMap, ([ testId, probe ]) => [ `${id}_${testId}`, probe.uuid ]));

		await Promise.all([
			this.redis.hSet('gp:in-progress', id, startTime.getTime()),
			this.redis.set(getMeasurementKey(id, 'probes_awaiting'), onlineProbesMap.size, { EX: config.get<number>('measurement.timeout') + 30 }),
			this.redis.json.set(key, '$', measurementWithoutDefaults),
			this.redis.json.set(getMeasurementKey(id, 'ips'), '$', allProbes.map(probe => probe.ipAddress)),
			this.redis.json.set(getMeasurementKey(id, 'meta'), '$', exportMeta),
			this.redis.expire(key, config.get<number>('measurement.resultTTL')),
			this.redis.expire(getMeasurementKey(id, 'ips'), config.get<number>('measurement.resultTTL')),
			this.redis.expire(getMeasurementKey(id, 'meta'), config.get<number>('measurement.resultTTL')),
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

	async storeMeasurementResult (data: MeasurementResultMessage): Promise<MeasurementRecord | null> {
		const isFinished = await this.redis.recordResult(data.measurementId, data.testId, data.result);

		if (isFinished) {
			return this.markFinished(data.measurementId);
		}

		return null;
	}

	async markFinished (id: string): Promise<MeasurementRecord | null> {
		const [ record ] = await Promise.all([
			this.redis.markFinished(id),
			this.redis.hDel('gp:in-progress', id),
		]);

		if (record) {
			this.offloader.enqueueForOffload(record);
		}

		return record;
	}

	async markFinishedByTimeout (ids: string[]): Promise<void> {
		if (ids.length === 0) {
			return;
		}

		const keys = ids.map(id => getMeasurementKey(id));
		const measurements = (await Bluebird.map(keys, key => this.redis.json.get(key) as Promise<MeasurementRecord | null>, { concurrency: 8 })).filter(is.truthy);

		for (const measurement of measurements) {
			measurement.status = 'finished';
			measurement.updatedAt = new Date().toISOString();
			const inProgressResults = measurement.results.filter(resultObject => resultObject.result.status === 'in-progress');

			for (const resultObject of inProgressResults) {
				resultObject.result.status = 'failed';
				resultObject.result.rawOutput += '\n\nThe measurement timed out.';
			}
		}

		const updateMeasurements = Bluebird.map(measurements, measurement => this.redis.json.set(getMeasurementKey(measurement.id), '$', measurement), { concurrency: 32 });
		const deleteAwaitingKeys = Bluebird.map(ids, id => this.redis.del(getMeasurementKey(id, 'probes_awaiting')), { concurrency: 32 });

		await Promise.all([
			this.redis.hDel('gp:in-progress', ids),
			deleteAwaitingKeys,
			updateMeasurements,
		]);

		for (const measurement of measurements) {
			this.offloader.enqueueForOffload(measurement);
		}
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

	startOffloadWorker () {
		this.offloader.startRetryWorker();
	}

	async setOffloadedExpiration (ids: string[]): Promise<void> {
		if (ids.length === 0) {
			return;
		}

		await Bluebird.map(ids, id => this.redis.expire(getMeasurementKey(id), 60 * 60), { concurrency: 8 });
	}

	removeDefaults (measurement: Partial<MeasurementRecord>, request: MeasurementRequest): Partial<MeasurementRecord> {
		const defaults = getDefaults(request);

		// Removes `"limit": 1` from locations. E.g. [{"country": "US", "limit": 1}] => [{"country": "US"}]
		if (_.isArray(measurement.locations)) {
			measurement.locations = measurement.locations.map(location => location.limit === 1 ? _.omit(location, 'limit') : location);
		}

		return subtractObjects(measurement, defaults) as Partial<MeasurementRecord>;
	}

	probesToResults (probes: (ServerProbe | OfflineProbe)[], type: RequestType) {
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

	getInitialResult (type: RequestType, status: ServerProbe['status'] | OfflineProbe['status']) {
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
		store.startOffloadWorker();
	}

	return store;
};
