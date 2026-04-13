import { brotliCompress as brotliCompressCallback, constants as zlibConstants } from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompress = promisify(brotliCompressCallback);

const roundIdTime = (createdAt) => {
	createdAt.setUTCSeconds(0);
	createdAt.setUTCMilliseconds(0);
	return createdAt;
};

const measurementId = '2E2SZgEwA6W6HvzlT0001z9VK';
const createdAt = new Date('2025-10-21T13:22:00.000Z');
const updatedAt = new Date('2025-10-21T13:22:05.000Z');

export const seed = async (knex) => {
	const roundedCreatedAt = roundIdTime(new Date(createdAt));
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
		createdAt: roundedCreatedAt,
		data: compressed,
	});
};
