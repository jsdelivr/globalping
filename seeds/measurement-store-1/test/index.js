import { brotliCompress as brotliCompressCallback, constants as zlibConstants } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import cryptoRandomString from 'crypto-random-string';
import base62 from '@sindresorhus/base62';

const brotliCompress = promisify(brotliCompressCallback);
const newmanEnvPath = new URL('../../../test/tests/contract/newman-env.json', import.meta.url);

const roundIdTime = (createdAt) => {
	createdAt.setUTCSeconds(0);
	createdAt.setUTCMilliseconds(0);
	return createdAt;
};

const generateMeasurementId = (createdAt) => {
	const idVersion = 2;
	const storageStrategy = 0;
	const storageLocation = 0;
	const userTier = 0;
	const minutesSinceEpoch = Math.floor(createdAt.valueOf() / 60_000);
	const random = cryptoRandomString({ length: 16, type: 'alphanumeric' });

	return `${base62.encodeInteger(idVersion)}${random}${base62.encodeInteger(storageStrategy)}${base62.encodeInteger(storageLocation)}${base62.encodeInteger(userTier)}${base62.encodeInteger(minutesSinceEpoch)}`;
};

const loadNewmanEnv = async () => {
	try {
		return JSON.parse(await readFile(newmanEnvPath, 'utf8'));
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return {};
		}

		throw error;
	}
};

export const seed = async (knex) => {
	const createdAt = new Date(Date.now() - 40 * 60_000);
	const updatedAt = new Date(createdAt.getTime() + 5_000);
	const measurementId = generateMeasurementId(createdAt);
	const measurement = {
		id: measurementId,
		type: 'ping',
		status: 'finished',
		target: 'example.com',
		createdAt: createdAt.toISOString(),
		updatedAt: updatedAt.toISOString(),
		probesCount: 1,
		results: [],
	};

	const compressed = await brotliCompress(JSON.stringify(measurement), {
		params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 1 },
	});

	await knex('measurement_anonymous').delete();

	await knex('measurement_anonymous').insert({
		id: measurementId,
		createdAt: roundIdTime(new Date(createdAt)),
		data: compressed,
	});

	const newmanEnv = await loadNewmanEnv();
	const values = Array.isArray(newmanEnv.values) ? newmanEnv.values : [];
	const otherValues = values.filter(entry => entry?.key !== 'measurementId');

	await writeFile(newmanEnvPath, JSON.stringify({
		...newmanEnv,
		values: [
			...otherValues,
			{
				key: 'measurementId',
				value: measurementId,
				enabled: true,
			},
		],
	}, null, '\t') + '\n');
};
