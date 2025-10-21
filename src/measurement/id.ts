import _ from 'lodash';
import base62 from '@sindresorhus/base62';
import cryptoRandomString from 'crypto-random-string';
import type { ValueOf } from 'type-fest';

import { AuthenticateStateUser } from '../lib/http/middleware/authenticate.js';
import type { Inverted } from '../types.js';

export const USER_TIER = {
	member: 1,
	sponsor: 2,
	special: 3,
	anonymous: 0,
} as const;

export const STORAGE_STRATEGY = {
	combined: 0,
	postgres: 1,
} as const;

export const STORAGE_LOCATION = {
	postgresV1: 0,
} as const;

export const USER_TIER_INVERTED = _.invert(USER_TIER) as Inverted<typeof USER_TIER>;
export const STORAGE_STRATEGY_INVERTED = _.invert(STORAGE_STRATEGY) as Inverted<typeof STORAGE_STRATEGY>;
export const STORAGE_LOCATION_INVERTED = _.invert(STORAGE_LOCATION) as Inverted<typeof STORAGE_LOCATION>;

export type UserTier = keyof typeof USER_TIER;

type ParsedMeasurementId = {
	version: number;
	storageStrategy: ValueOf<typeof STORAGE_STRATEGY>;
	storageLocation: ValueOf<typeof STORAGE_LOCATION>;
	userTier: ValueOf<typeof USER_TIER>;
	minutesSinceEpoch: number;
	random: string;
};

export const generateMeasurementId = (startTime: Date, userType?: AuthenticateStateUser['userType']) => {
	const idVersion = 2;
	const storageStrategy = STORAGE_STRATEGY.combined;
	const storageLocation = STORAGE_LOCATION.postgresV1;
	const userTier = userType ? USER_TIER[userType] : USER_TIER.anonymous;
	const minutesSinceEpoch = Math.floor(startTime.valueOf() / 60000);
	const random = cryptoRandomString({ length: 16, type: 'alphanumeric' });

	return `${base62.encodeInteger(idVersion)}${base62.encodeInteger(storageStrategy)}${base62.encodeInteger(storageLocation)}${base62.encodeInteger(userTier)}${random}${base62.encodeInteger(minutesSinceEpoch)}`;
};

export const parseMeasurementId = (id: string): ParsedMeasurementId => {
	const version = base62.decodeInteger(id[0]!);

	if (version !== 2) {
		throw new Error(`Unsupported measurement ID version: ${id}`);
	}

	return parseMeasurementIdV2(id);
};

function parseMeasurementIdV2 (id: string): ParsedMeasurementId {
	if (id.length < 24) {
		throw new Error(`Measurement ID must be at least 24 characters long: ${id}`);
	}

	const storageStrategy = base62.decodeInteger(id[1]!) as ParsedMeasurementId['storageStrategy'];

	if (!STORAGE_STRATEGY_INVERTED[storageStrategy]) {
		throw new Error(`Unknown storage strategy: ${id}`);
	}

	const storageLocation = base62.decodeInteger(id[2]!) as ParsedMeasurementId['storageLocation'];

	if (!STORAGE_LOCATION_INVERTED[storageLocation]) {
		throw new Error(`Unknown storage location: ${id}`);
	}

	const userTier = base62.decodeInteger(id[3]!) as ParsedMeasurementId['userTier'];

	if (!USER_TIER_INVERTED[userTier]) {
		throw new Error(`Unknown user tier: ${id}`);
	}

	const minutesSinceEpoch = base62.decodeInteger(id.slice(20));
	const random = id.slice(4, 20);

	return {
		version: 2,
		storageStrategy,
		storageLocation,
		userTier,
		minutesSinceEpoch,
		random,
	};
}
