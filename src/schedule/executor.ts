import config from 'config';
import _ from 'lodash';
import { PROBES_NAMESPACE } from '../lib/ws/server.js';
import { scopedLogger } from '../lib/logger.js';
import type { ServerProbe } from '../probe/types.js';
import type { ProbesLocationFilter } from '../probe/probes-location-filter.js';
import type { MeasurementRequest } from '../measurement/types.js';
import type { Schedule } from './types.js';
import type { WsServer } from '../lib/ws/server.js';
import type { SyncedProbeList } from '../lib/ws/synced-probe-list.js';
import type { MeasurementStore } from '../measurement/store.js';
import { getMeasurementStore } from '../measurement/store.js';
import { getStreamScheduleLoader, type ScheduleLoader } from './loader.js';

const logger = scopedLogger('schedule-executor');

export class StreamScheduleExecutor {
	private readonly timers = new Map<string, { id: NodeJS.Timeout; interval: number }>();
	private readonly onUpdate = () => this.syncTimers();

	constructor (
		private readonly io: WsServer,
		private readonly syncedProbeList: SyncedProbeList,
		private readonly loader: ScheduleLoader,
		private readonly locationFilter: ProbesLocationFilter,
		private readonly store: MeasurementStore,
	) {}

	start () {
		this.syncTimers();
		this.loader.on('update', this.onUpdate);
	}

	stop () {
		this.loader.off('update', this.onUpdate);

		for (const timer of this.timers.values()) {
			clearInterval(timer.id);
		}

		this.timers.clear();
	}

	private syncTimers () {
		const desiredIds = new Set<string>();
		const schedules = this.loader.getAll();

		for (const schedule of schedules) {
			if (!schedule.enabled) {
				continue;
			}

			desiredIds.add(schedule.id);

			const timer = this.timers.get(schedule.id);

			if (timer && timer.interval !== schedule.interval) {
				clearInterval(timer.id);
				this.timers.delete(schedule.id);
			}

			if (!this.timers.has(schedule.id)) {
				this.createTimer(schedule.id, schedule.interval);
			}
		}

		for (const id of this.timers.keys()) {
			if (!desiredIds.has(id)) {
				const timer = this.timers.get(id);
				this.timers.delete(id);
				clearInterval(timer?.id);
			}
		}
	}

	private createTimer (scheduleId: string, intervalSeconds: number) {
		const sec = _.random(0, Math.min(intervalSeconds, 59));
		const intervalMs = intervalSeconds * 1000;

		logger.debug(`Creating schedule timer for ${scheduleId} at ${sec}s interval.`);

		// Align to the chosen second in the current minute
		const now = new Date();
		const next = new Date(now);
		next.setSeconds(sec, 0);

		while (next <= now) {
			next.setTime(next.getTime() + intervalMs);
		}

		const delay = next.getTime() - now.getTime();
		const onError = (error: unknown) => logger.error('Stream schedule execution error', error);

		const setTimer = (id: NodeJS.Timeout) => {
			this.timers.set(scheduleId, { interval: intervalSeconds, id });
		};

		const first = setTimeout(() => {
			const interval = setInterval(() => {
				this.fireSchedule(scheduleId).catch(onError);
			}, intervalMs).unref();

			this.fireSchedule(scheduleId).catch(onError);
			setTimer(interval);
		}, delay).unref();

		setTimer(first);
	}

	private async fireSchedule (scheduleId: string) {
		const schedule = this.loader.getById(scheduleId);

		if (!schedule) {
			return;
		}

		const localProbes = this.getFilteredLocalProbes(schedule);

		if (localProbes.length === 0) {
			return;
		}

		const chunkSize = config.get<number>('measurement.limits.authenticatedTestsPerMeasurement');
		const probesChunks = _.chunk(localProbes, chunkSize);

		for (const configuration of schedule.configurations) {
			if (!configuration.enabled) {
				continue;
			}

			const requestBase = {
				type: configuration.measurement_type,
				target: configuration.measurement_target,
				measurementOptions: configuration.measurement_options,
				locations: schedule.locations,
				scheduleId: schedule.id,
				configurationId: configuration.id,
				inProgressUpdates: false,
				limit: undefined,
			};

			for (const probesChunk of probesChunks) {
				const probesMap = new Map<number, ServerProbe>(probesChunk.map((s, idx) => [ idx, s ]));
				const measurementId = await this.store.createMeasurement(requestBase, probesMap, probesChunk, 'special', {
					timeSeriesEnabled: Boolean(schedule.time_series_enabled),
				});

				logger.debug(`Executing a scheduled measurement.`, { measurementId, scheduleId });

				for (const [ idx, probe ] of probesChunk.entries()) {
					this.emitMeasurementToProbe(probe, requestBase, measurementId, idx);
				}
			}
		}
	}

	private getFilteredLocalProbes (schedule: Schedule) {
		const localProbes = this.syncedProbeList.getLocalProbes();

		if (schedule.locations.length === 0) {
			return localProbes;
		}

		const allowed = new Set<ServerProbe>();

		for (const location of schedule.locations) {
			const matches = this.locationFilter.filterByLocation(localProbes, location);

			for (const probe of matches) {
				allowed.add(probe);
			}
		}

		return localProbes.filter(probe => allowed.has(probe));
	}

	private emitMeasurementToProbe (
		probe: ServerProbe,
		requestBase: MeasurementRequest,
		measurementId: string,
		testId: number,
	) {
		this.io.of(PROBES_NAMESPACE).to(probe.client).emit('probe:measurement:request', {
			measurementId,
			testId: testId.toString(),
			measurement: {
				...requestBase.measurementOptions,
				type: requestBase.type,
				target: requestBase.target,
				inProgressUpdates: requestBase.inProgressUpdates,
			},
		});
	}
}

export const initStreamScheduleExecutor = (
	io: WsServer,
	syncedProbeList: SyncedProbeList,
	locationFilter: ProbesLocationFilter,
) => {
	return new StreamScheduleExecutor(
		io,
		syncedProbeList,
		getStreamScheduleLoader(),
		locationFilter,
		getMeasurementStore(),
	);
};
