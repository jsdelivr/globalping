import _ from 'lodash';
import apmAgent from 'elastic-apm-node';
import type { Middleware } from 'koa';

export class MetricsAgent {
	private readonly counters: Record<string, number> = {};
	private readonly statsAvg: Record<string, number[]> = {};
	private readonly statsMed: Record<string, number[]> = {};
	private readonly statsMax: Record<string, number[]> = {};

	recordMeasurementTime (type: string, time: number): void {
		this.recordStats(`gp.measurement.time.${type}`, time);
	}

	recordMeasurement (type: string, probeCount: number): void {
		this.incrementCounter(`gp.measurement.count.${type}`);
		this.incrementCounter('gp.measurement.count.total');
		this.incrementCounter(`gp.test.count.${type}`, probeCount);
		this.incrementCounter('gp.test.count.total', probeCount);
	}

	recordDisconnect (type: string): void {
		this.incrementCounter(`gp.probe.disconnect_${type.replaceAll(' ', '_')}`);
	}

	recordProbeSyncGap (operation: 'push' | 'pull', value: number): void {
		this.recordStats(`gp.probe_sync.${operation}_gap.ms`, value);
	}

	recordProbeSyncPullEvents (eventType: 'alive' | 'reload' | 'remove' | 'update' | 'stats', value: number): void {
		this.incrementCounter(`gp.probe_sync.pull.event.count.${eventType}`, value);
	}

	recordNoProbesFound (): void {
		this.incrementCounter('gp.measurement.no_probes_found.count');
	}

	recordMeasurementCompleted (type: string): void {
		this.incrementCounter(`gp.measurement.completed.count.${type}`);
		this.incrementCounter('gp.measurement.completed.count.total');
	}

	recordMeasurementTimeout (type: string, testCount: number): void {
		this.incrementCounter(`gp.measurement.timeout.count.${type}`);
		this.incrementCounter('gp.measurement.timeout.count.total');
		this.incrementCounter(`gp.test.timeout.count.${type}`, testCount);
		this.incrementCounter('gp.test.timeout.count.total', testCount);
	}

	private incrementCounter (name: string, value: number = 1): void {
		if (!this.counters[name]) {
			this.registerCounter(name);
		}

		this.counters[name]! += value;
	}

	private registerCounter (name: string): void {
		this.counters[name] = 0;

		registerGuardedMetric(name, () => {
			const value = this.counters[name];
			this.counters[name] = 0;
			return value;
		});
	}

	private recordStats (name: string, value: number): void {
		if (!this.statsAvg[name]) {
			this.registerStats(name);
		}

		this.statsAvg[name]!.push(value);
		this.statsMed[name]!.push(value);
		this.statsMax[name]!.push(value);
	}

	private registerStats (name: string): void {
		this.statsAvg[name] = [];
		this.statsMed[name] = [];
		this.statsMax[name] = [];

		registerGuardedMetric(`${name}.avg`, () => {
			const value = _.mean(this.statsAvg[name]);
			this.statsAvg[name] = [];
			return value;
		});

		registerGuardedMetric(`${name}.median`, () => {
			const value = median(this.statsMed[name]!);
			this.statsMed[name] = [];
			return value;
		});

		registerGuardedMetric(`${name}.max`, () => {
			const value = _.max(this.statsMax[name]);
			this.statsMax[name] = [];
			return value;
		});
	}
}

export const metricsAgent = new MetricsAgent();

export const captureSpan = <R>(name: string, fn: () => R): R => {
	const span = apmAgent.startSpan(name, 'app', 'custom');

	try {
		const result = fn();
		const isThenable = _.isObject(result) && 'then' in result;

		if (isThenable) {
			void Promise.resolve(result)
				.finally(() => {
					span?.end();
				})
				.catch(() => {});
		} else {
			span?.end();
		}

		return result;
	} catch (error) {
		span?.end();
		throw error;
	}
};

export const captureMiddlewareSpan = <State = unknown, Context = unknown>(
	middleware: Middleware<State, Context>,
	{
		name = middleware.name || 'middleware',
		phase = 'up',
	}: {
		name?: string;
		phase?: 'up' | 'down';
	} = {},
): Middleware<State, Context> => {
	const startSpan = () => apmAgent.startSpan(name, 'app', 'middleware');

	if (phase === 'down') {
		return async (ctx, next) => {
			const span = startSpan();

			try {
				await middleware(ctx, () => {
					span?.end();
					return next();
				});
			} finally {
				span?.end();
			}
		};
	}

	return async (ctx, next) => {
		let span: ReturnType<typeof startSpan> | undefined;

		try {
			await middleware(ctx, async () => {
				await next();

				if (!span) {
					span = startSpan();
				}
			});
		} finally {
			span?.end();
		}
	};
};

export const captureMiddlewareChainSpan = <State = unknown, Context = unknown>(
	name: string = 'middleware',
	subtype: string = 'middleware',
): Middleware<State, Context> => {
	const startSpan = () => apmAgent.startSpan(name, 'app', subtype);

	return async (_ctx, next) => {
		const span = startSpan();

		try {
			await next();
		} finally {
			span?.end();
		}
	};
};

function median (values: number[]): number | undefined {
	values.sort((a, b) => a - b);
	const half = Math.floor(values.length / 2);

	if (values.length % 2) {
		return values[half];
	}

	return (values[half - 1]! + values[half]!) / 2;
}

export function registerGuardedMetric (name: string, callback: () => number | undefined): void {
	apmAgent.registerMetric(name, () => {
		const value = callback();
		return value || 0; // NaN/undefined => 0
	});
}
