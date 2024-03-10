/* eslint-disable no-var */
import type { ExtendedFakeTimers } from './utils/clock.js';

export type DeepPartial<T> = T extends Record<string, any> ? {
	[P in keyof T]?: DeepPartial<T[P]>;
} : T;

declare global {
	var clock: ExtendedFakeTimers;
}
