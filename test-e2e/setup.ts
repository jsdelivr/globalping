import got from 'got';
import { setTimeout } from 'timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chai from 'chai';

import chaiOas from '../test/plugins/oas/index.js';
import type { Probe } from '../src/probe/types.js';
import { removeProbeContainer, startProbeContainer } from './docker.js';

const waitProbeToConnect = async () => {
	let response;

	for (;;) {
		try {
			response = await got('http://localhost:3000/v1/probes');
		} catch (err) {
			console.log(err.code);
			throw err;
		}

		const probes = JSON.parse(response.body) as Probe[];

		if (probes.length > 0) {
			return;
		}

		await setTimeout(1000);
	}
};

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	await startProbeContainer();

	await waitProbeToConnect();
});

after(async () => {
	await removeProbeContainer();
});
