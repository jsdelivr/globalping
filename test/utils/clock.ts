import type { SinonFakeTimers } from 'sinon';

export type ExtendedFakeTimers = SinonFakeTimers & {
	pause(): ExtendedFakeTimers;
	unpause(): ExtendedFakeTimers;
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

	return Object.assign(clock, {
		pause,
		unpause,
	}) as ExtendedFakeTimers;
};
