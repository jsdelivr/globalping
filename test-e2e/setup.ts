import Docker from 'dockerode';
import got from 'got';
import { setTimeout } from 'timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chai from 'chai';

import chaiOas from '../test/plugins/oas/index.js';
import type { Probe } from '../src/probe/types.js';

let container: Docker.Container;

const isLinuxHost = async (docker: Docker) => {
	const versionInfo = await docker.version();
	const platformName = versionInfo.Platform.Name.toLowerCase();
	const isLinuxHost = platformName.includes('engine');
	return isLinuxHost;
};

const attachLogs = async (container: Docker.Container) => {
	const stream = await container.logs({
		follow: true,
		stdout: true,
		stderr: true,
	});
	container.modem.demuxStream(stream, process.stdout, process.stderr);
};

const waitForProbeToConnect = async () => {
	for (;;) {
		const response = await got('http://localhost:3000/v1/probes');
		console.log('response.statusCode', response.statusCode);
		console.log('response.body', response.body);
		const probes = JSON.parse(response.body) as Probe[];
		console.log('probes', probes);

		if (probes.length > 0) {
			return;
		}

		await setTimeout(1000);
	}
};

before(async () => {
	chai.use(await chaiOas({ specPath: path.join(fileURLToPath(new URL('.', import.meta.url)), '../public/v1/spec.yaml') }));

	const docker = new Docker();

	const isLinux = await isLinuxHost(docker);

	container = await docker.createContainer({
		Image: 'ghcr.io/jsdelivr/globalping-probe',
		name: 'globalping-probe-e2e',
		Env: [
			`API_HOST=ws://${isLinux ? 'localhost' : 'host.docker.internal'}:3000`, // https://github.com/moby/moby/pull/40007
		],
		HostConfig: {
			LogConfig: {
				Type: 'local',
				Config: {},
			},
			NetworkMode: 'host',
		},
	});

	await container.start({});

	await attachLogs(container);

	await waitForProbeToConnect();
});

after(async () => {
	await container.remove({ force: true });
});
