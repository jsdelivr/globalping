import got, { type RequestError } from 'got';
import { setTimeout } from 'timers/promises';

import type { Probe } from '../src/probe/types.js';

export const waitProbeToConnect = async () => {
	let response;

	for (;;) {
		try {
			response = await got('http://localhost:80/v1/probes');
		} catch (err) {
			console.log((err as RequestError).code);
			await setTimeout(1000);
			continue;
		}

		const probes = JSON.parse(response.body) as Probe[];

		if (probes.length > 0) {
			return;
		}

		await setTimeout(1000);
	}
};

export const waitProbeInCity = async (city: string) => {
	let response;

	for (;;) {
		try {
			response = await got('http://localhost:80/v1/probes');
		} catch (err) {
			console.log((err as RequestError).code);
			throw err;
		}

		const probes = JSON.parse(response.body) as Probe[];

		if (probes.length > 0 && probes[0]!.location.city === city) {
			return;
		}

		await setTimeout(1000);
	}
};

export const waitMesurementFinish = async (id: string) => {
	for (;;) {
		const response = await got(`http://localhost:80/v1/measurements/${id}`);
		const body = JSON.parse(response.body);

		if (body.status !== 'in-progress') {
			return { response, body };
		}

		await setTimeout(500);
	}
};
