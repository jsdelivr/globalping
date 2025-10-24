import _ from 'lodash';
import config from 'config';
import process from 'node:process';
import { EventEmitter } from 'node:events';
import { scopedLogger } from './logger.js';

const logger = scopedLogger('sigterm-listener');

class TermListener extends EventEmitter<{ terminating: [{ signal: string; delay: number }] }> {
	private isTerminating: boolean;

	constructor () {
		super();
		this.isTerminating = false;
		const sigtermDelay = config.get<number>('sigtermDelay');
		sigtermDelay && this.attachListener(sigtermDelay);
	}

	public getIsTerminating () {
		return this.isTerminating;
	}

	private attachListener (delay: number) {
		const listener = _.once((signal: string) => {
			logger.info(`Process ${process.pid} received a ${signal} signal: ${delay}ms delay before exit`);
			this.isTerminating = true;

			setTimeout(() => {
				logger.info('Exiting');
				process.exit(0);
			}, delay);

			this.emit('terminating', { signal, delay });
		});

		[ 'SIGINT', 'SIGTERM' ].forEach(signal => process.on(signal, listener));
	}
}

const termListener = new TermListener();

export default termListener;
