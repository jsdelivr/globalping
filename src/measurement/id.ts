import base62 from '@sindresorhus/base62';
import cryptoRandomString from 'crypto-random-string';
import { AuthenticateStateUser } from '../lib/http/middleware/authenticate.js';

const USER_TYPE = {
	member: 1,
	sponsor: 2,
	special: 3,
	anonymous: 0,
};

const STORAGE_STRATEGY = {
	combined: 0,
	postgres: 1,
};

const STORAGE_LOCATION = {
	postgresV1: 0,
};

export const generateMeasurementId = (startTime: Date, userType?: AuthenticateStateUser['userType']) => {
	const idVersion = 2;
	const storageStrategy = STORAGE_STRATEGY.combined;
	const storageLocation = STORAGE_LOCATION.postgresV1;
	const userTier = userType ? USER_TYPE[userType] : USER_TYPE.anonymous;
	const minutesSinceEpoch = Math.floor(startTime.valueOf() / 60000);
	const random = cryptoRandomString({ length: 16, type: 'alphanumeric' });

	return `${base62.encodeInteger(idVersion)}${base62.encodeInteger(storageStrategy)}${base62.encodeInteger(storageLocation)}${base62.encodeInteger(userTier)}${random}${base62.encodeInteger(minutesSinceEpoch)}`;
};
