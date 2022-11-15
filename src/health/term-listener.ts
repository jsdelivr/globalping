import process from 'node:process';
import {scopedLogger} from '../lib/logger.js';

const logger = scopedLogger('sigterm-listener');

class TermListener {
	private isTerminating: boolean;

	constructor() {
		this.isTerminating = false;
		this.attachListener();
	}

	public getIsTerminating() {
		return this.isTerminating;
	}

	private attachListener() {
		process.on('SIGTERM', signal => {
			logger.info(`Process ${process.pid} received a ${signal} signal`);
			this.isTerminating = true;
			setTimeout(() => {
				logger.info('Exiting');
				process.exit(0);
			}, 15_000);
		});
	}
}

const termListener = new TermListener();

export default termListener;
