import { MeasurementOptions } from '../measurement/types.js';
import { Location } from '../lib/location/types.js';

export type ScheduleRow = {
	id: string;
	name: string;
	mode: 'stream' | 'batch';
	interval: number;
	locations: string;
	probe_limit: number | null;
	date_updated: Date | null;
	date_created: Date;
	time_series_enabled: 0 | 1;
	enabled: 0 | 1;
};

export type ConfigurationRow = {
	id: string;
	schedule_id: string;
	name: string;
	measurement_type: 'http' | 'dns' | 'ping' | 'traceroute' | 'mtr';
	measurement_target: string;
	measurement_options: string;
	date_updated: Date | null;
	date_created: Date;
	enabled: 0 | 1;
};

export type Schedule = {
	id: ScheduleRow['id'];
	name: ScheduleRow['name'];
	mode: ScheduleRow['mode'];
	interval: ScheduleRow['interval'];
	locations: Location[];
	probe_limit: ScheduleRow['probe_limit'];
	time_series_enabled: ScheduleRow['time_series_enabled'];
	enabled: ScheduleRow['enabled'];
	configurations: Array<Pick<ConfigurationRow, 'id' | 'name' | 'measurement_type' | 'measurement_target' | 'enabled'> & { measurement_options: MeasurementOptions }>;
};
