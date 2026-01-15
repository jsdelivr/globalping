import _ from 'lodash';
import config from 'config';
import cluster from 'node:cluster';
import process from 'node:process';
import { EventEmitter } from 'node:events';
import { scopedLogger } from './logger.js';
import is from '@sindresorhus/is';

const logger = scopedLogger('sigterm-listener');

export class MasterTermListener {
	private readonly delay = config.get<number>('sigtermDelay');

	constructor () {
		this.delay && this.attachSignalListener();
	}

	private attachSignalListener () {
		const listener = _.once((signal: string) => {
			logger.info(`Process ${process.pid} received a ${signal} signal: ${this.delay}ms delay before exit`);

			if (cluster.workers) {
				Object.values(cluster.workers).forEach(worker => worker?.send({ type: 'terminating', signal, delay: this.delay }));
			}

			setTimeout(() => {
				logger.info('Exiting');
				process.exit(0);
			}, this.delay);
		});

		[ 'SIGINT', 'SIGTERM' ].forEach(signal => process.on(signal, listener));
	}
}

export class WorkerTermListener extends EventEmitter<{ terminating: [{ signal: string; delay: number }] }> {
	private isTerminating: boolean = false;

	constructor () {
		super();
		this.attachMasterListener();
	}

	public getIsTerminating () {
		return this.isTerminating;
	}

	private attachMasterListener () {
		process.on('message', (message) => {
			if (is.plainObject(message) && message['type'] === 'terminating') {
				const { signal, delay } = message as { type: string; signal: string; delay: number };
				logger.info(`Worker ${process.pid} received ${signal} signal from master.`);
				this.isTerminating = true;
				this.emit('terminating', { signal, delay });
			}
		});
	}
}

const emptyListener = { on: () => {}, getIsTerminating: () => false };

const termListener = cluster.isWorker ? new WorkerTermListener() : emptyListener;

export default termListener;
