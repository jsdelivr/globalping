import type { SinonFakeTimers } from 'sinon';

export type ExtendedFakeTimers = SinonFakeTimers & {
	pause(): ExtendedFakeTimers;
	unpause(): ExtendedFakeTimers;
	tickAsyncStepped(time: number, step?: number): Promise<void>;
};

export const extendSinonClock = (clock: SinonFakeTimers): ExtendedFakeTimers => {
	const pause = () => {
		// @ts-expect-error need to use the original clearInterval here
		clock._clearInterval(clock.attachedInterval);

		return clock;
	};

	const unpause = () => {
		pause();

		// @ts-expect-error need to use the original delta here
		const advanceTimeDelta = clock.advanceTimeDelta;

		// @ts-expect-error need to use the original setInterval here
		clock._setInterval(() => {
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
