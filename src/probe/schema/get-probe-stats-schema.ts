import Joi from 'joi';
import type { ProbeTestStatsRange } from '../test-stats-storage.js';

type GetProbeStatsQuery = {
	period: ProbeTestStatsRange;
};

type Interval = ProbeTestStatsRange['interval'];
type Period = { from: number; to: number; interval: Interval };

const RETENTION_MONTHS = 14;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const BUCKET_SIZES: Record<Interval, number> = { hour: HOUR, day: DAY };

const ROLLING_PERIODS = new Map<string, { length: number; interval: Interval }>([
	[ 'day', { length: DAY, interval: 'hour' }],
	[ 'week', { length: 7 * DAY, interval: 'hour' }],
	[ 'month', { length: 30 * DAY, interval: 'day' }],
	[ 'year', { length: 365 * DAY, interval: 'day' }],
]);

const CALENDAR_PERIOD_PATTERN = /^\d{4}(-\d{2}){0,2}$/;

const floorTo = (time: number, unit: number) => Math.floor(time / unit) * unit;

const subtractMonths = (time: number, months: number) => {
	const date = new Date(time);
	const lastDayOfTargetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months + 1, 0)).getUTCDate();
	return date.setUTCMonth(date.getUTCMonth() - months, Math.min(date.getUTCDate(), lastDayOfTargetMonth));
};

const parseCalendarPeriod = (period: string): Period | null => {
	if (!CALENDAR_PERIOD_PATTERN.test(period)) {
		return null;
	}

	const [ year, month, day ] = period.split('-').map(Number) as [ number, number?, number? ];
	const from = Date.UTC(year, (month ?? 1) - 1, day ?? 1);
	const date = new Date(from);

	// reject non-existent dates
	if (date.getUTCFullYear() !== year || (month && date.getUTCMonth() + 1 !== month) || (day && date.getUTCDate() !== day)) {
		return null;
	}

	return day
		? { from, to: from + DAY, interval: 'hour' }
		: { from, to: Date.UTC(year, month ?? 12, 1), interval: 'day' };
};

export const resolveStatsPeriod = (period: string, now = Date.now()): ProbeTestStatsRange | null => {
	const rolling = ROLLING_PERIODS.get(period);
	const range: Period | null = rolling
		? { from: floorTo(now, BUCKET_SIZES[rolling.interval]) - rolling.length, to: now, interval: rolling.interval }
		: parseCalendarPeriod(period);

	const retentionStart = subtractMonths(now, RETENTION_MONTHS);

	if (!range || range.from > now || range.to <= retentionStart) {
		return null;
	}

	const bucketSize = BUCKET_SIZES[range.interval];

	return {
		from: new Date(Math.max(range.from, Math.ceil(retentionStart / bucketSize) * bucketSize)),
		to: new Date(Math.min(range.to, floorTo(now, bucketSize))),
		interval: range.interval,
	};
};

const periodSchema = Joi.string().max(10).custom((value: string, helpers) => {
	return resolveStatsPeriod(value) ?? helpers.error('any.invalid');
}).messages({
	'any.invalid': '{{#label}} must be one of [day, week, month, year], or a UTC date in the YYYY-MM-DD, YYYY-MM, or YYYY format within the past 14 months',
});

export const schema = Joi.object<GetProbeStatsQuery>({
	period: periodSchema.required(),
}).unknown(false);
