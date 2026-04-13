import type { SinonFakeTimers } from 'sinon';

export type ExtendedFakeTimers = SinonFakeTimers & {
	pause(): ExtendedFakeTimers;
	unpause(): ExtendedFakeTimers;
	tickAsyncStepped(time: number, step?: number): Promise<void>;
};

export const extendSinonClock = (clock: SinonFakeTimers): ExtendedFakeTimers => {
	const pause = () => {
		// @ts-expect-error exit if already paused
		if (!clock.attachedInterval) {
			return clock;
		}

		// @ts-expect-error need to use the original clearInterval here
		clock._clearInterval(clock.attachedInterval);
		// @ts-expect-error keep the internal handle in sync with the actual timer state
		clock.attachedInterval = undefined;

		return clock;
	};

	const unpause = () => {
		// @ts-expect-error exit if not paused
		if (clock.attachedInterval) {
			return clock;
		}

		// @ts-expect-error need to use the original delta here
		const advanceTimeDelta = clock.tickMode.delta;

		if (!advanceTimeDelta) {
			throw new Error('Cannot advance time without a delta');
		}

		// @ts-expect-error need to use the original setInterval here
		clock.attachedInterval = clock._setInterval(() => {
			clock.tick(advanceTimeDelta);
		}, advanceTimeDelta);

		return clock;
	};

	const tickAsyncStepped = async (time: number, step = 20) => {
		while (time > 0) {
			await clock.tickAsync(Math.min(step, time));
			time -= step;
		}
	};

	return Object.assign(clock, {
		pause,
		unpause,
		tickAsyncStepped,
	}) as ExtendedFakeTimers;
};
