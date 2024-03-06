import Docker from 'dockerode';

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

export const startProbeContainer = async () => {
	const docker = new Docker();

	const isLinux = await isLinuxHost(docker);

	const container = await docker.createContainer({
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
};

export const removeProbeContainer = async () => {
	const docker = new Docker();
	const containers = await docker.listContainers({ all: true });
	const containerInfo = containers.find(c => c.Names.includes('/globalping-probe-e2e'));

	if (!containerInfo) {
		console.log('Container not found:');
		return;
	}

	const container = docker.getContainer(containerInfo.Id);

	await container.remove({ force: true });
};
