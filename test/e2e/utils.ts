import got, { type RequestError } from 'got';
import { setTimeout } from 'timers/promises';
import { scopedLogger } from './logger.js';

const logger = scopedLogger('e2e-utils');

export const waitProbeToDisconnect = async () => {
	let responses;

	for (;;) {
		try {
			responses = await Promise.all([
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
			]);
		} catch (err) {
			logger.info((err as RequestError).code);
			await setTimeout(1000);
			continue;
		}

		if (responses.every(response => response.body.length === 0)) {
			return;
		}

		await setTimeout(1000);
	}
};

export const waitProbeToConnect = async () => {
	let responses;

	for (;;) {
		try {
			responses = await Promise.all([
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
			]);
		} catch (err) {
			logger.info((err as RequestError).code);
			await setTimeout(1000);
			continue;
		}

		if (responses.every(response => response.body.length > 0)) {
			return;
		}

		await setTimeout(1000);
	}
};

export const waitProbeInCity = async (city: string) => {
	let responses;

	for (;;) {
		try {
			responses = await Promise.all([
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
				got<any>('http://localhost:80/v1/probes', { responseType: 'json' }),
			]);
		} catch (err) {
			logger.info((err as RequestError).code);
			throw err;
		}

		if (responses.every(response => response.body.length > 0 && response.body[0].location.city === city)) {
			return;
		}

		await setTimeout(1000);
	}
};

export const waitMesurementFinish = async (id: string) => {
	for (;;) {
		const response = await got<any>(`http://localhost:80/v1/measurements/${id}`, { responseType: 'json' });

		if (response.body.status !== 'in-progress') {
			return response;
		}

		await setTimeout(500);
	}
};
