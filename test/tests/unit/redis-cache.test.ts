import { expect } from 'chai';
import * as sinon from 'sinon';
import * as td from 'testdouble';
import type { RedisClient } from '../../../src/lib/redis/client.js';
import type RedisCache from '../../../src/lib/cache/redis-cache.js';

describe('RedisCache', () => {
	const sandbox = sinon.createSandbox();
	const redisClient = {
		set: sandbox.stub(),
		get: sandbox.stub(),
		del: sandbox.stub(),
	};
	const noticeError = sandbox.stub();
	let redisCache: RedisCache;

	before(async () => {
		await td.replaceEsm('newrelic', {}, { noticeError });
		const { default: RedisCache } = await import('../../../src/lib/cache/redis-cache.js');
		redisCache = new RedisCache(redisClient as unknown as RedisClient);
	});

	beforeEach(() => {
		sandbox.resetHistory();
	});

	describe('set', () => {
		it('should set a value in the cache', async () => {
			const result = await redisCache.set('testKey', 'testValue', 1000);

			expect(result).to.equal(undefined);
			expect(redisClient.set.callCount).to.equal(1);
			expect(redisClient.set.args[0]).to.deep.equal([ 'gp:cache:testKey', '"testValue"', { PX: 1000 }]);
		});

		it('should handle an error when setting a value in the cache', async () => {
			const error = new Error('set error');
			redisClient.set.throws(error);

			const result = await redisCache.set('testKey', 'testValue', 1000);

			expect(result).to.equal(undefined);
			expect(noticeError.args[0]).to.deep.equal([ error, { key: 'testKey', ttl: 1000 }]);
		});
	});

	describe('get', () => {
		it('should get a value from the cache', async () => {
			redisClient.get.resolves('"testValue"');

			const result = await redisCache.get('testKey');

			expect(result).to.equal('testValue');
			expect(redisClient.get.callCount).to.equal(1);
			expect(redisClient.get.args[0]).to.deep.equal([ 'gp:cache:testKey' ]);
		});

		it('should return null if the key does not exist in the cache', async () => {
			redisClient.get.resolves(null);

			const result = await redisCache.get('nonExistentKey');

			expect(result).to.equal(null);
			expect(redisClient.get.callCount).to.equal(1);
			expect(redisClient.get.args[0]).to.deep.equal([ 'gp:cache:nonExistentKey' ]);
		});

		it('should handle an error when getting a value from the cache', async () => {
			const error = new Error('get error');
			redisClient.get.throws(error);

			const result = await redisCache.get('testKey');

			expect(result).to.equal(null);
			expect(noticeError.args[0]).to.deep.equal([ error, { key: 'testKey' }]);
		});
	});

	describe('delete', () => {
		it('should delete a value from the cache and return the deleted value', async () => {
			redisClient.get.resolves('"testValue"');

			const result = await redisCache.delete('testKey');

			expect(result).to.equal('testValue');
			expect(redisClient.get.callCount).to.equal(1);
			expect(redisClient.del.callCount).to.equal(1);
			expect(redisClient.get.args[0]).to.deep.equal([ 'gp:cache:testKey' ]);
			expect(redisClient.del.args[0]).to.deep.equal([ 'gp:cache:testKey' ]);
		});

		it('should handle an error when deleting a value from the cache', async () => {
			const error = new Error('delete error');
			redisClient.get.throws(error);

			const result = await redisCache.delete('testKey');

			expect(result).to.equal(null);
			expect(noticeError.args[0]).to.deep.equal([ error, { key: 'testKey' }]);
		});
	});
});
