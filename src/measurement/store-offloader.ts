import { promisify } from 'node:util';
import { brotliCompress as brotliCompressCallback, brotliDecompress as brotliDecompressCallback, constants as zlibConstants } from 'node:zlib';
import { Queue as BullQueue, Worker } from 'bullmq';
import BatchQueue from '@martin-kolarik/batch-queue';
import Bluebird from 'bluebird';
import is from '@sindresorhus/is';
import config from 'config';

import { scopedLogger } from '../lib/logger.js';
import type { Knex } from 'knex';
import { parseMeasurementId, roundIdTime, USER_TIER_INVERTED, UserTier } from './id.js';
import type { MeasurementRecord } from './types.js';
import { MeasurementStore } from './store.js';

const logger = scopedLogger('db-store');
const brotliCompress = promisify(brotliCompressCallback);
const brotliDecompress = promisify(brotliDecompressCallback);

const compressRecord = (record: string): Promise<Buffer> => {
	return brotliCompress(JSON.stringify(record), { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } });
};

const decompressRecord = async (buffer: Buffer): Promise<string> => {
	return (await brotliDecompress(buffer)).toString();
};

export class MeasurementStoreOffloader {
	private readonly fallbackQueue: BullQueue;
	private readonly fallbackQueueName = 'measurement-db-store-fallback';
	private readonly offloadQueues: Record<UserTier, InstanceType<typeof BatchQueue>>;

	constructor (
		private readonly measurementStoreDb: Knex,
		private readonly primaryMeasurementStore: MeasurementStore,
	) {
		this.fallbackQueue = new BullQueue<{ tier: UserTier; ids: string[] }>(this.fallbackQueueName, {
			connection: this.getBullConnectionOptions(),
			defaultJobOptions: {
				attempts: 28,
				backoff: { type: 'custom' },
				removeOnComplete: true,
				removeOnFail: true,
				stackTraceLimit: 0,
				keepLogs: 0,
			},
		});

		this.offloadQueues = {
			member: this.createTierQueue('member'),
			special: this.createTierQueue('special'),
			sponsor: this.createTierQueue('sponsor'),
			anonymous: this.createTierQueue('anonymous'),
		};
	}

	enqueueForOffload (measurement: MeasurementRecord) {
		const tier = this.getTierFromMeasurementId(measurement.id);
		this.offloadQueues[tier].push(measurement);
	}

	async getMeasurementString (id: string, userTierNum: keyof typeof USER_TIER_INVERTED, createdAtRounded: number): Promise<string | null> {
		const tier = USER_TIER_INVERTED[userTierNum];
		const table = `measurement_${tier}`;
		const createdAt = new Date(createdAtRounded);

		const row = await this.measurementStoreDb(table)
			.where({ id, createdAt })
			.select<{ data: Buffer }[]>('data')
			.first();

		if (!row) {
			return null;
		}

		return decompressRecord(row.data);
	}

	startRetryWorker () {
		const worker = new Worker<{ tier: UserTier; ids: string[] }>(
			this.fallbackQueueName,
			async (job) => {
				await this.insertBatchToDbByIds(job.data.tier, job.data.ids);
			},
			{
				connection: this.getBullConnectionOptions(),
				concurrency: 4,
				settings: {
					backoffStrategy (attempts) {
						if (attempts > 8) {
							return 300_000;
						}

						return 2 ** (attempts - 1) * 2_000;
					},
				},
			},
		);

		worker.on('error', (err) => {
			logger.error('Store worker error:', err);
		});

		worker.on('failed', (job, error) => {
			if (job?.finishedOn) {
				logger.error(`Job failed on all ${job?.attemptsMade} attempts:`, error);
			} else {
				logger.debug(`Job failed on attempt ${job?.attemptsMade}:`, error);
			}
		});

		return worker;
	}

	private createTierQueue (tier: UserTier) {
		return new BatchQueue(async (measurements: MeasurementRecord[]) => {
			try {
				await this.insertBatchToDb(tier, measurements);
			} catch (error) {
				logger.error(`Failed to insert batch for tier ${tier}. Creating a fallback job.`, error);

				try {
					await this.enqueueFallbackJob(tier, measurements.map(m => m.id));
				} catch (jobError) {
					logger.error('Failed to enqueue the fallback job.', jobError);
				}
			}
		}, { batchSize: 100, timeout: 2000 });
	}

	private getBullConnectionOptions () {
		const url = config.get<string>('redis.standalonePersistentNoEviction.url');
		const password = config.get<string>('redis.sharedOptions.password');
		const tls = config.get<boolean>('redis.sharedOptions.socket.tls');

		return { url, password, tls };
	}

	private getTierFromMeasurementId (id: string): UserTier {
		return USER_TIER_INVERTED[parseMeasurementId(id).userTier];
	}

	private async insertBatchToDb (tier: UserTier, measurements: MeasurementRecord[]) {
		if (measurements.length === 0) {
			return;
		}

		const table = `measurement_${tier}`;
		const rows = await Bluebird.map(measurements, async (r) => {
			return {
				id: r.id,
				createdAt: roundIdTime(new Date(r.createdAt)),
				data: await compressRecord(JSON.stringify(r)),
			};
		}, { concurrency: 4 });

		await this.measurementStoreDb(table)
			.insert(rows)
			.onConflict([ 'id', 'createdAt' ])
			.ignore();

		await this.primaryMeasurementStore.updateLatestOffloadedTimestamp(rows[0]!.createdAt);
		await this.primaryMeasurementStore.setOffloadedExpiration(measurements.map(m => m.id));
	}

	private async enqueueFallbackJob (tier: UserTier, ids: string[]) {
		await this.fallbackQueue.add('insert-measurements', { tier, ids });
	}

	private async insertBatchToDbByIds (tier: UserTier, ids: string[]) {
		const records = await this.primaryMeasurementStore.getMeasurements(ids);
		return this.insertBatchToDb(tier, records.filter(is.truthy));
	}
}
