import config from 'config';
import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import * as td from 'testdouble';
import * as sinon from 'sinon';

describe('index file', () => {
	const cluster: any = new EventEmitter();
	cluster.isPrimary = true;
	cluster.fork = sinon.stub();

	before(async () => {
		await td.replaceEsm('node:cluster', null, cluster);
	});

	beforeEach(() => {
		cluster.fork.reset();
	});

	after(() => {
		td.reset();
	});

	it('master should fork the configured number of processes', async () => {
		await import('../../../src/index.js');

		expect(cluster.fork.callCount).to.equal(config.get<number>('server.processes'));
	});

	it('master should restart a worker if it dies', async () => {
		await import('../../../src/index.js');

		cluster.emit('exit', { process: { pid: 123 } });

		expect(cluster.fork.callCount).to.equal(1);
	});
});
