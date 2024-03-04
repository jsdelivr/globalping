import Docker from 'dockerode';
import { setTimeout } from 'timers/promises';

let container: Docker.Container;

before(async () => {
	const docker = new Docker();

	const versionInfo = await docker.version();
	console.log('versionInfo', versionInfo);
	const platformName = versionInfo.Platform.Name.toLowerCase();
	console.log('platformName', platformName);
	const isLinuxHost = platformName.includes('engine');

	container = await docker.createContainer({
		Image: 'ghcr.io/jsdelivr/globalping-probe',
		name: 'globalping-probe-e2e',
		Env: [
			`API_HOST=ws://${isLinuxHost ? 'localhost' : 'host.docker.internal'}:3000`, // https://github.com/moby/moby/pull/40007
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

	const stream = await container.logs({
		follow: true,
		stdout: true,
		stderr: true,
	});
	container.modem.demuxStream(stream, process.stdout, process.stderr);

	await setTimeout(5000);
});

after(async () => {
	await container.remove({ force: true });
});
