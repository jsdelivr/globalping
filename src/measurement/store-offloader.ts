import config from 'config';
import { Queue as BullQueue, JobsOptions, Worker } from 'bullmq';
import BatchQueue from '@martin-kolarik/batch-queue';
import is from '@sindresorhus/is';

import { scopedLogger } from '../lib/logger.js';
import type { Knex } from 'knex';
import { parseMeasurementId, USER_TIER_INVERTED, UserTier } from './id.js';
import type { MeasurementRecord } from './types.js';
import { MeasurementStore } from './store.js';

const logger = scopedLogger('db-store');

export class MeasurementStoreOffloader {
	private readonly fallbackQueue: BullQueue;
	private readonly fallbackQueueName = 'measurement-db-store-fallback';
	private readonly offloadQueues: Record<UserTier, InstanceType<typeof BatchQueue>>;

	constructor (
		private readonly measurementStoreDb: Knex,
		private readonly primaryMeasurementStore: MeasurementStore,
	) {
		this.fallbackQueue = new BullQueue(this.fallbackQueueName, this.buildBullConnectionOptions());

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

	startRetryWorker () {
		const worker = new Worker<{ tier: UserTier; ids: string[] }>(
			this.fallbackQueueName,
			async (job) => {
				await this.insertBatchToDbByIds(job.data.tier, job.data.ids);
			},
			{
				...this.buildBullConnectionOptions(),
				concurrency: 4,
				settings: {
					backoffStrategy (attempts) {
						if (attempts >= 28) {
							return -1;
						} else if (attempts > 8) {
							return 300;
						}

						return 2 ** (attempts - 1) * 2000;
					},
				},
			},
		);

		worker.on('error', (err) => {
			logger.error('Store worker error', err);
		});

		return worker;
	}

	private buildBullConnectionOptions () {
		const redisUrl = config.get<string>('redis.standalonePersistent.url');
		const password = config.get<string>('redis.sharedOptions.password');
		const tls = config.get<boolean>('redis.sharedOptions.socket.tls');
		const url = new URL(redisUrl);

		if (password) {
			url.username = '';
			url.password = password;
		}

		if (tls) {
			url.protocol = 'rediss:';
		}

		return { connection: { url: url.toString() } };
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

	private getTierFromMeasurementId (id: string): UserTier {
		return USER_TIER_INVERTED[parseMeasurementId(id).userTier];
	}

	private async insertBatchToDb (tier: UserTier, measurements: MeasurementRecord[]) {
		const table = `measurement_${tier}`;
		const rows = measurements.map((r) => {
			return {
				id: r.id,
				createdAt: new Date(r.createdAt),
				data: r,
			};
		});

		if (rows.length === 0) {
			return;
		}

		await this.measurementStoreDb(table)
			.insert(rows)
			.onConflict([ 'id', 'createdAt' ])
			.ignore();
	}

	private async enqueueFallbackJob (tier: UserTier, ids: string[]) {
		const jobOptions: JobsOptions = {
			attempts: 28,
			backoff: { type: 'custom' },
			removeOnComplete: true,
			removeOnFail: false,
		};

		await this.fallbackQueue.add('insert-measurements', { tier, ids }, jobOptions);
	}

	private async insertBatchToDbByIds (tier: UserTier, ids: string[]) {
		const table = `measurement_${tier}`;
		const records = (await this.primaryMeasurementStore.getMeasurements(ids)).filter(is.truthy);
		const rows = records
			.map(r => r && { id: r.id, createdAt: new Date(r.createdAt), data: r as unknown })
			.filter(Boolean) as { id: string; createdAt: Date; data: unknown }[];

		if (rows.length === 0) {
			return;
		}

		await this.measurementStoreDb(table)
			.insert(rows)
			.onConflict([ 'id', 'createdAt' ])
			.ignore();
	}
}
