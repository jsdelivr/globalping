import Docker from 'dockerode';
import got from 'got';
import { setTimeout } from 'timers/promises';

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
		const probes = await got('http://localhost:3000/v1/probes').json<Probe[]>();

		if (probes.length > 0) {
			return;
		}

		await setTimeout(500);
	}
};

before(async () => {
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
