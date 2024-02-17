import config from 'config';
import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import * as td from 'testdouble';
import * as sinon from 'sinon';
import { getRedisClient, type RedisClient } from '../../../src/lib/redis/client.js';
import { getPersistentRedisClient } from '../../../src/lib/redis/persistent-client.js';

describe('index file', () => {
	const cluster: any = new EventEmitter();
	cluster.isPrimary = true;
	cluster.fork = sinon.stub();
	let redis: RedisClient;
	let persistentRedis: RedisClient;

	const readFile = sinon.stub().resolves('commitHash');

	before(async () => {
		redis = getRedisClient();
		persistentRedis = getPersistentRedisClient();
	});

	beforeEach(async () => {
		sinon.resetHistory();
		await td.replaceEsm('node:cluster', null, cluster);
		await td.replaceEsm('node:fs/promises', { readFile, writeFile: sinon.stub() });
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

	it('master should flush non-persistent redis if commits hashes do not match', async () => {
		redis.set('testfield', 'testvalue');
		persistentRedis.set('testfield', 'testvalue');
		readFile.resolves('oldCommitHash');

		persistentRedis.set('LAST_API_COMMIT_HASH_test', 'commitHash');

		await import('../../../src/index.js');

		const value = await redis.get('testfield');
		const persistentValue = await persistentRedis.get('testfield');
		expect(value).to.equal(null);
		expect(persistentValue).to.equal('testvalue');
	});

	it('master should not flush non-persistent redis if commits hashes match', async () => {
		redis.set('testfield', 'testvalue');
		persistentRedis.set('testfield', 'testvalue');
		readFile.resolves('commitHash');

		persistentRedis.set('LAST_API_COMMIT_HASH_test', 'commitHash');

		await import('../../../src/index.js');

		const value = await redis.get('testfield');
		const persistentValue = await persistentRedis.get('testfield');
		expect(value).to.equal('testvalue');
		expect(persistentValue).to.equal('testvalue');
	});
});
