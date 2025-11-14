import type { Server } from 'node:http';
import { brotliCompress as brotliCompressCallback, default as zlib } from 'node:zlib';
import { promisify } from 'node:util';
import request, { Agent } from 'supertest';
import Bluebird from 'bluebird';
import { expect } from 'chai';

import { getTestServer } from '../../../utils/server.js';
import { measurementStoreClient } from '../../../../src/lib/sql/client.js';
import { getMeasurementRedisClient } from '../../../../src/lib/redis/measurement-client.js';
import { generateMeasurementId, roundIdTime } from '../../../../src/measurement/id.js';
import { getMeasurementKey } from '../../../../src/measurement/store.js';

const brotliCompress = promisify(brotliCompressCallback);

describe('Get measurement', () => {
	let app: Server;
	let requestAgent: Agent;

	const buildMeasurementRecord = (id: string, time: Date) => {
		return {
			id,
			type: 'ping',
			status: 'finished',
			createdAt: time.toISOString(),
			updatedAt: time.toISOString(),
			target: 'example.com',
			probesCount: 1,
			results: [],
		};
	};

	before(async () => {
		app = await getTestServer();
		requestAgent = request(app);
	});

	describe('errors', () => {
		it('should respond with a 404 for a non-existing measurement id', async () => {
			const nonExisting = generateMeasurementId(new Date());

			await requestAgent
				.get(`/v1/measurements/${nonExisting}`)
				.expect(404)
				.expect((response) => {
					expect(response.body.error).to.include({
						message: 'Couldn\'t find the requested measurement.',
						type: 'not_found',
					});

					expect(response).to.matchApiSchema();
				});
		});

		it('should respond 404 for an invalid id format', async () => {
			await requestAgent
				.get('/v1/measurements/invalid-id-123')
				.expect(404)
				.expect((response) => {
					expect(response.body.error.type).to.equal('not_found');
					expect(response).to.matchApiSchema();
				});
		});
	});

	describe('success (from Redis)', () => {
		const redisKeysToCleanup: string[] = [];

		afterEach(async () => {
			const redis = getMeasurementRedisClient();

			await Bluebird.map(redisKeysToCleanup.splice(0), (key) => {
				return redis.del(key);
			});
		});

		it('should return measurement JSON stored in Redis', async () => {
			const now = new Date();
			const id = generateMeasurementId(now);
			const key = getMeasurementKey(id);
			const record = buildMeasurementRecord(id, now);

			const redis = getMeasurementRedisClient();
			await redis.json.set(key, '$', record);
			redisKeysToCleanup.push(key);

			await requestAgent
				.get(`/v1/measurements/${id}`)
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal(record);
					expect(response).to.matchApiSchema();
				});
		});
	});

	describe('success (from Postgres offload)', () => {
		const redisKeysToCleanup: string[] = [];
		const dbRowsToCleanup: { table: string; id: string; createdAt: Date }[] = [];

		afterEach(async () => {
			const redis = getMeasurementRedisClient();

			await Bluebird.map(redisKeysToCleanup.splice(0), (key) => {
				return redis.del(key);
			});

			await Bluebird.map(dbRowsToCleanup.splice(0), (row) => {
				return measurementStoreClient(row.table)
					.where({ id: row.id, createdAt: row.createdAt })
					.delete();
			});
		});

		it('should return measurement JSON from the offloaded store when likely offloaded and older than 30 minutes', async () => {
			// Create an ID in the past (> 30 minutes)
			const createdAt = new Date(Date.now() - 40 * 60_000);
			const id = generateMeasurementId(createdAt);
			const roundedCreatedAt = roundIdTime(new Date(createdAt));

			// Seed Postgres offload table for anonymous tier
			const table = 'measurement_anonymous';
			const record = buildMeasurementRecord(id, createdAt);
			const compressed = await brotliCompress(JSON.stringify(record), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1 } });
			await measurementStoreClient(table).insert({ id, createdAt: new Date(roundedCreatedAt), data: compressed });
			dbRowsToCleanup.push({ table, id, createdAt: new Date(roundedCreatedAt) });

			// Ensure Redis does not have this key
			const key = getMeasurementKey(id);
			const redis = getMeasurementRedisClient();
			await redis.del(key);

			await requestAgent
				.get(`/v1/measurements/${id}`)
				.expect(200)
				.expect((response) => {
					expect(response.body).to.deep.equal(record);
					expect(response).to.matchApiSchema();
				});
		});
	});
});
