import type { Knex } from 'knex';
import type { Probe } from '../probe/types.js';
import { scopedLogger } from './logger.js';

const logger = scopedLogger('admin-data');

export class AdminData {
	constructor (private readonly sql: Knex) {}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, 60_000).unref();
	}

	async syncDashboardData () {
		// Implement
	}

	getUpdatedLocation (probe: Probe) {
		// Implement
		return probe.location;
	}
}
