import config from 'config';
import got, { type RequestError } from 'got';
import _ from 'lodash';
import { setTimeout } from 'timers/promises';
import { dashboardClient } from '../../src/lib/sql/client.js';
import { scopedLogger } from '../../src/lib/logger.js';

const logger = scopedLogger('e2e-utils');

const processes = config.get<number>('server.processes');
logger.info(`There are ${processes} workers running.`);

export type GetProbeLogsResponse = {
	lastId: string | null;
	logs: {
		message: string;
		timestamp: string | null;
		scope: string | null;
		level: string | null;
	}[];
};

export const waitProbeToDisconnect = async () => {
	let responses;

	for (;;) {
		try {
			// Probe list sync across workers takes a few seconds. So we should retry until all workers return the same result. Multiplying by 2 for safety.
			responses = await Promise.all(_.times(processes * 2, (() => got<any>('http://localhost:80/v1/probes', { responseType: 'json' }))));
		} catch (err) {
			logger.info((err as RequestError).code);
			await setTimeout(100);
			continue;
		}

		if (responses.every(response => response.body.length === 0)) {
			return;
		}

		await setTimeout(100);
	}
};

export const waitProbeToConnect = async () => {
	let responses;

	for (;;) {
		try {
			responses = await Promise.all(_.times(processes * 2, (() => got<any>('http://localhost:80/v1/probes', { responseType: 'json' }))));
		} catch (err) {
			logger.info((err as RequestError).code);
			await setTimeout(100);
			continue;
		}

		if (responses.every(response => response.body.length > 0)) {
			return;
		}

		await setTimeout(100);
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

		await setTimeout(100);
	}
};

export const waitMeasurementFinish = async (id: string) => {
	for (;;) {
		const response = await got<any>(`http://localhost:80/v1/measurements/${id}`, { responseType: 'json' });

		if (response.body.status !== 'in-progress') {
			return response;
		}

		await setTimeout(100);
	}
};

export const waitRowInTable = async (table: string) => {
	for (;;) {
		const row = await dashboardClient(table).first();

		if (row) {
			return row;
		}

		await setTimeout(100);
	}
};

export const waitForLogSync = async (id: string, authCookie: string, after?: string, timeout: number = 25000) => {
	const start = Date.now();
	const query = after === undefined ? '' : `?after=${after}`;

	while (true) {
		const response = await got<GetProbeLogsResponse>(
			`http://localhost:80/v1/probes/${id}/logs${query}`,
			{
				responseType: 'json',
				throwHttpErrors: false,
				headers: { Cookie: authCookie },
			},
		);

		if (response.body.lastId && (after === undefined || response.body.lastId !== after)) {
			return response;
		}

		if (Date.now() - start > timeout) {
			throw new Error('Log sync timed out.');
		}

		await setTimeout(100);
	}
};

export const waitForStableProbeLogs = async (id: string, authCookie: string, quietInterval: number = 1000, timeout: number = 25000) => {
	const start = Date.now();
	let unchangedSince = start;
	let previousBody: GetProbeLogsResponse | undefined;

	while (true) {
		const requestTimeout = timeout - (Date.now() - start);

		if (requestTimeout <= 0) {
			throw new Error('Probe logs did not stabilize.');
		}

		const response = await got<GetProbeLogsResponse>(
			`http://localhost:80/v1/probes/${id}/logs`,
			{
				responseType: 'json',
				throwHttpErrors: false,
				followRedirect: false,
				headers: { Cookie: authCookie },
				timeout: { request: requestTimeout },
				retry: { limit: 0 },
			},
		).catch((error: RequestError) => {
			if (error.code === 'ETIMEDOUT' || Date.now() - start >= timeout) {
				throw new Error('Probe logs did not stabilize.');
			}

			throw error;
		});
		const now = Date.now();

		if (response.statusCode === 200 && previousBody && _.isEqual(response.body, previousBody)) {
			if (now - unchangedSince >= quietInterval) {
				return response;
			}
		} else {
			previousBody = response.statusCode === 200 ? response.body : undefined;
			unchangedSince = now;
		}

		if (now - start >= timeout) {
			throw new Error('Probe logs did not stabilize.');
		}

		const remaining = timeout - (Date.now() - start);

		if (remaining <= 0) {
			throw new Error('Probe logs did not stabilize.');
		}

		await setTimeout(Math.min(100, remaining));
	}
};
