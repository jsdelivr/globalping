import {SchemaFieldTypes} from 'redis';
import {PROBE_STORE_IDX_KEY} from '../../probe/store.js';
import {getRedisClient} from './client.js';

export const ensureProbeSearchIndex = async () => {
	const client = getRedisClient();

	try {
		await client.ft.create(
			PROBE_STORE_IDX_KEY,
			{
				country: {
					type: SchemaFieldTypes.TAG,
				},
				city: {
					type: SchemaFieldTypes.TAG,
				},
				continent: {
					type: SchemaFieldTypes.TAG,
				},
				region: {
					type: SchemaFieldTypes.TAG,
				},
			},

			{ON: 'HASH', PREFIX: 'gp:probes:'},
		);
	} catch (error: unknown) {
		if (!(error instanceof Error) || error.message === 'Index already exists') {
			return;
		}

		throw error;
	}
};
