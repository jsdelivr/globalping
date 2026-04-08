import { consumeResetAfterFailure } from './failure-reset.js';

type HookContext = {
	timeout: (ms: number) => void;
};

type SetupOptions = {
	timeout?: number;
};

/**
 * Registers a `beforeEach` hook that runs test suite setup:
 * - on the suite's first test run
 * - after a previous test failure triggered a global E2E state reset
 *
 * Subsequent tests skip setup unless another reset is consumed.
 *
 * @param setup Async function that prepares suite-specific state.
 * @param options Optional hook settings.
 * @param options.timeout Per-hook timeout in milliseconds.
 */
export const beforeTest = (
	setup: () => Promise<void>,
	options: SetupOptions = {},
) => {
	let initialized = false;

	beforeEach(async function (this: HookContext) {
		if (options.timeout) {
			this.timeout(options.timeout);
		}

		const resetAfterFailure = consumeResetAfterFailure();

		if (initialized && !resetAfterFailure) {
			return;
		}

		await setup();
		initialized = true;
	});
};

