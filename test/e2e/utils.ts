import got, { type RequestError } from 'got';
import { setTimeout } from 'timers/promises';
import { scopedLogger } from '../../src/lib/logger.js';

const logger = scopedLogger('e2e-utils');

export const waitProbeToDisconnect = async () => {
	let response;

	for (;;) {
		try {
			response = await got<any>('http://localhost:80/v1/probes', { responseType: 'json' });
		} catch (err) {
			logger.info((err as RequestError).code);
			await setTimeout(1000);
			continue;
		}

		if (response.body.length === 0) {
			return;
		}

		await setTimeout(1000);
	}
};

export const waitProbeToConnect = async () => {
	let response;

	for (;;) {
		try {
			response = await got<any>('http://localhost:80/v1/probes', { responseType: 'json' });
		} catch (err) {
			logger.info((err as RequestError).code);
			await setTimeout(1000);
			continue;
		}

		if (response.body.length > 0) {
			return;
		}

		await setTimeout(1000);
	}
};

export const waitProbeInCity = async (city: string) => {
	let response;

	for (;;) {
		try {
			response = await got<any>('http://localhost:80/v1/probes', { responseType: 'json' });
		} catch (err) {
			logger.info((err as RequestError).code);
			throw err;
		}

		if (response.body.length > 0 && response.body[0].location.city === city) {
			return;
		}

		await setTimeout(1000);
	}
};

export const waitMesurementFinish = async (id: string) => {
	for (;;) {
		const response = await got<any>(`http://localhost:80/v1/measurements/${id}`, { responseType: 'json' });

		if (response.body.status !== 'in-progress') {
			logger.info('return');
			return response;
		}

		await setTimeout(500);
	}
};
