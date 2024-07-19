import config from 'config';
import process from 'node:process';
import { scopedLogger } from '../lib/logger.js';

const logger = scopedLogger('sigterm-listener');

class TermListener {
	private isTerminating: boolean;

	constructor () {
		this.isTerminating = false;
		const sigtermDelay = config.get<number>('sigtermDelay');
		sigtermDelay && this.attachListener(sigtermDelay);
	}

	public getIsTerminating () {
		return this.isTerminating;
	}

	private attachListener (delay: number) {
		process.on('SIGTERM', (signal) => {
			logger.info(`Process ${process.pid} received a ${signal} signal`);
			this.isTerminating = true;

			setTimeout(() => {
				logger.info('Exiting');
				process.exit(0);
			}, delay);
		});
	}
}

const termListener = new TermListener();

export default termListener;
