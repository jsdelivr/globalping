import config from 'config';
import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import * as td from 'testdouble';
import * as sinon from 'sinon';
import { getRedisClient, type RedisClient } from '../../../src/lib/redis/client.js';
import { getPersistentRedisClient } from '../../../src/lib/redis/persistent-client.js';

describe('index file', () => {
	const sandbox = sinon.createSandbox();
	const cluster: any = new EventEmitter();
	cluster.isPrimary = true;
	cluster.fork = sandbox.stub().returns({ process: { pid: 0 } });
	let redis: RedisClient;
	let persistentRedis: RedisClient;

	const readFile = sandbox.stub().resolves('commitHash');

	before(async () => {
		redis = getRedisClient();
		persistentRedis = getPersistentRedisClient();
	});

	beforeEach(async () => {
		sandbox.resetHistory();
		await td.replaceEsm('node:cluster', null, cluster);
		await td.replaceEsm('node:fs/promises', { readFile, writeFile: sandbox.stub() });
	});

	after(() => {
		td.reset();
		redis.del('testfield');
		persistentRedis.del('testfield');
	});

	it('master should restart a worker if it dies', async () => {
		cluster.fork.onFirstCall().returns({ process: { pid: 1 } });
		cluster.fork.onSecondCall().returns({ process: { pid: 2 } });
		await import('../../../src/index.js');

		cluster.emit('exit', { process: { pid: 1 } });
		cluster.emit('exit', { process: { pid: 2 } });

		expect(cluster.fork.callCount).to.equal(4);
		expect(cluster.fork.args[0]).to.deep.equal([{ SHOULD_SYNC_ADOPTIONS: true }]);
		expect(cluster.fork.args[1]).to.deep.equal([]);
		expect(cluster.fork.args[2]).to.deep.equal([{ SHOULD_SYNC_ADOPTIONS: true }]);
		expect(cluster.fork.args[3]).to.deep.equal([]);
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
