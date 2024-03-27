import config from 'config';
import got, { type RequestError } from 'got';
import _ from 'lodash';
import { setTimeout } from 'timers/promises';
import { scopedLogger } from '../../src/lib/logger.js';

const logger = scopedLogger('e2e-utils');

const processes = config.get<number>('server.processes');
logger.info(`There are ${processes} workers running.`);

export const waitProbeToDisconnect = async () => {
	let responses;

	for (;;) {
		try {
			responses = await Promise.all(_.times(processes * 2, (() => got<any>('http://localhost:80/v1/probes', { responseType: 'json' }))));
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
			responses = await Promise.all(_.times(processes * 2, (() => got<any>('http://localhost:80/v1/probes', { responseType: 'json' }))));
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
			responses = await Promise.all(_.times(processes * 2, (() => got<any>('http://localhost:80/v1/probes', { responseType: 'json' }))));
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
