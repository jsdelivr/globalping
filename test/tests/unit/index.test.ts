import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import * as td from 'testdouble';
import * as sinon from 'sinon';

describe('index file', () => {
	const cluster: any = new EventEmitter();
	cluster.isPrimary = true;
	cluster.fork = sinon.stub();

	before(async () => {
		await td.replaceEsm('physical-cpu-count', null, 4);
		await td.replaceEsm('node:cluster', null, cluster);
	});

	beforeEach(() => {
		cluster.fork.reset();
	});

	it('master should fork a worker for each physical CPU', async () => {
		await import('../../../src/index.js');

		expect(cluster.fork.callCount).to.equal(4);
	});

	it('master should restart a worker if it dies', async () => {
		await import('../../../src/index.js');

		cluster.emit('exit', { process: { pid: 123 } });

		expect(cluster.fork.callCount).to.equal(1);
	});
});
