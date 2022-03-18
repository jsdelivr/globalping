import * as RateLimiterFlexible from 'rate-limiter-flexible';
import type {IRateLimiterStoreOptions} from 'rate-limiter-flexible';
import type {RedisClient} from '../redis/client.js';

type GetPointsResult = number[];
type RemainingPointsResult = number[];

type Options = IRateLimiterStoreOptions & {storeClient: RedisClient};

export class RateLimiterRedis extends RateLimiterFlexible.RateLimiterRedis {
	client: RedisClient;

	constructor(options: Options) {
		super(options);

		// Only god know why it doesnt detect its type
		this.client = options.storeClient as RedisClient;
	}

	_getRateLimiterRes(_rlKey: string, changedPoints: number, result: RemainingPointsResult): any {
		const [points, ttl] = result;
		const consumedPoints = Number(points);
		const remainingPoints = Math.max(this.points - consumedPoints, 0);
		const msBeforeNext = ttl;
		const isFirstInDuration = consumedPoints === changedPoints;

		return new RateLimiterFlexible.RateLimiterRes(remainingPoints, msBeforeNext, consumedPoints, isFirstInDuration);
	}

	async _upsert(rlKey: string, points: number, msDuration: number, forceExpire = false): Promise<GetPointsResult> {
		const secDuration = Math.floor(msDuration / 1000);

		const multi = this.client.multi();

		if (forceExpire) {
			if (secDuration > 0) {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				multi.set(rlKey, points, {EX: secDuration});
			} else {
				multi.set(rlKey, points);
			}
		} else {
			if (secDuration > 0) {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				await this.client.set(rlKey, 0, {EX: secDuration, NX: true});
				const consumed = await this.client.incrBy(rlKey, points);
				let ttl = await this.client.pTTL(rlKey);

				if (ttl === -1) {
					await this.client.expire(rlKey, secDuration);
					ttl = 1000 * secDuration;
				}

				return [consumed, ttl];
			}

			multi.incrBy(rlKey, points);
		}

		const result = await multi.pTTL(rlKey).exec();
		return result as GetPointsResult;
	}

	async _get(rlKey: string): Promise<GetPointsResult | undefined> {
		const result = await this.client.multi().get(rlKey).pTTL(rlKey).exec();

		if (!result) {
			return;
		}

		return result as GetPointsResult;
	}

	async _delete(rlKey: string): Promise<number> {
		return this.client.del(rlKey);
	}
}
