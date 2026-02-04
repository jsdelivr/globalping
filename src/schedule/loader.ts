import { EventEmitter } from 'node:events';
import type { Knex } from 'knex';
import config from 'config';
import _ from 'lodash';

import { scopedLogger } from '../lib/logger.js';
import { dashboardClient } from '../lib/sql/client.js';
import type { ConfigurationRow, Schedule, ScheduleRow } from './types.js';
import { MeasurementOptions } from '../measurement/types.js';

const logger = scopedLogger('schedule-loader');

export class ScheduleLoader extends EventEmitter {
	private timer: NodeJS.Timeout | undefined;
	private schedules = new Map<string, Schedule>();
	private scheduleUpdatedAt = new Map<string, number>();

	constructor (private readonly db: Knex) {
		super();
	}

	getAll (): Schedule[] {
		return [ ...this.schedules.values() ];
	}

	getById (id: string): Schedule | undefined {
		return this.schedules.get(id);
	}

	async sync () {
		const scheduleRows = await this.db<ScheduleRow>('gp_schedule')
			.where({ mode: 'stream', enabled: 1 })
			.select('*');

		const configurationRows = await this.db<ConfigurationRow>('gp_schedule_configuration')
			.where({ enabled: 1 })
			.select('*');

		const configsBySchedule = _.groupBy(configurationRows, 'schedule_id');
		const newSchedules = new Map<string, Schedule>();
		const newUpdatedAt = new Map<string, number>();

		for (const row of scheduleRows) {
			const updatedAt = (row.date_updated ?? row.date_created).getTime();
			newUpdatedAt.set(row.id, updatedAt);

			newSchedules.set(row.id, {
				id: row.id,
				name: row.name,
				mode: row.mode,
				interval: row.interval,
				locations: row.locations,
				time_series_enabled: row.time_series_enabled,
				configurations: (configsBySchedule[row.id] || []).map(c => ({
					id: c.id,
					name: c.name,
					measurement_type: c.measurement_type,
					measurement_target: c.measurement_target,
					measurement_options: JSON.parse(c.measurement_options) as MeasurementOptions,
				})),
			});
		}

		let changed = newSchedules.size < this.schedules.size;

		if (!changed) {
			for (const [ id, updatedAt ] of newUpdatedAt) {
				const prevUpdatedAt = this.scheduleUpdatedAt.get(id);

				if (prevUpdatedAt !== updatedAt) {
					changed = true;
					break;
				}
			}
		}

		this.schedules = newSchedules;
		this.scheduleUpdatedAt = newUpdatedAt;

		if (changed) {
			this.emit('update');
		}
	}

	scheduleSync (delay = 0) {
		this.timer = setTimeout(() => {
			this.sync()
				.finally(() => this.scheduleSync(config.get('scheduleData.syncInterval')))
				.catch(error => logger.error('Failed to load schedules', error));
		}, delay).unref();
	}

	unscheduleSync () {
		clearTimeout(this.timer);
	}
}

export const createStreamScheduleLoader = () => new ScheduleLoader(dashboardClient);

let streamScheduleLoader: ScheduleLoader | undefined;

export const initStreamScheduleLoader = () => {
	if (!streamScheduleLoader) {
		streamScheduleLoader = createStreamScheduleLoader();
		streamScheduleLoader.scheduleSync();
	}

	return streamScheduleLoader;
};

export const getStreamScheduleLoader = () => {
	if (!streamScheduleLoader) {
		throw new Error('ScheduleLoader not initialized yet');
	}

	return streamScheduleLoader;
};
