import config from 'config';
import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import * as td from 'testdouble';
import * as sinon from 'sinon';
import { getRedisClient, RedisClient } from '../../../src/lib/redis/client.js';
import { getPersistentRedisClient, PersistentRedisClient } from '../../../src/lib/redis/persistent-client.js';

describe('index file', () => {
	const cluster: any = new EventEmitter();
	cluster.isPrimary = true;
	cluster.fork = sinon.stub();
	let redis: RedisClient;
	let persistentRedis: PersistentRedisClient;

	before(async () => {
		redis = getRedisClient();
		persistentRedis = getPersistentRedisClient();
	});

	beforeEach(async () => {
		sinon.resetHistory();
		await td.replaceEsm('node:cluster', null, cluster);
	});

	after(() => {
		td.reset();
		redis.del('testfield');
		persistentRedis.del('testfield');
	});

	it('master should restart a worker if it dies', async () => {
		await import('../../../src/index.js');
		cluster.fork.resetHistory();

		cluster.emit('exit', { process: { pid: 123 } });

		expect(cluster.fork.callCount).to.equal(1);
	});

	it('master should fork the configured number of processes', async () => {
		await import('../../../src/index.js');

		expect(cluster.fork.callCount).to.equal(config.get<number>('server.processes'));
	});

	it('master should flush non-persistent redis db on startup', async () => {
		redis.set('testfield', 'testvalue');
		persistentRedis.set('testfield', 'testvalue');

		await import('../../../src/index.js');

		const value2 = await redis.get('testfield');
		const persistentValue2 = await persistentRedis.get('testfield');
		expect(value2).to.equal(null);
		expect(persistentValue2).to.equal('testvalue');
	});
});
