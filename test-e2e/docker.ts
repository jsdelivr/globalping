import Docker from 'dockerode';

const isLinuxHost = async (docker: Docker) => {
	const versionInfo = await docker.version();
	const platformName = versionInfo.Platform.Name.toLowerCase();
	console.log('platformName', platformName);
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

export const createApiContainer = async () => {
	const docker = new Docker();

	const isLinux = await isLinuxHost(docker);
	console.log('isLinux', isLinux);

	const container = await docker.createContainer({
		Image: 'globalping-api-e2e',
		name: 'globalping-api-e2e',
		Env: [
			'NODE_ENV=test',
			'TEST_MODE=e2e',
			'NEW_RELIC_ENABLED=false',
			'PORT=3000',
			`REDIS_URL=redis://${isLinux ? 'localhost' : 'host.docker.internal'}:6379`,
			`DB_CONNECTION_HOST=${isLinux ? 'localhost' : 'host.docker.internal'}`,
			// `REDIS_URL=redis://localhost:6379`,
			// `DB_CONNECTION_HOST=localhost`,
		],
		HostConfig: {
			PortBindings: {
				'3000/tcp': [{ HostPort: '3000' }],
			},
			NetworkMode: isLinux ? 'host' : 'bridge',
			// NetworkMode: 'host',
		},
	});

	await container.start({});

	await attachLogs(container);
};

export const createProbeContainer = async () => {
	const docker = new Docker();

	const isLinux = await isLinuxHost(docker);
	console.log('isLinux', isLinux);

	const container = await docker.createContainer({
		Image: 'ghcr.io/jsdelivr/globalping-probe',
		name: 'globalping-probe-e2e',
		Env: [
			`API_HOST=ws://${isLinux ? 'localhost' : 'host.docker.internal'}:3000`,
			// `API_HOST=ws://localhost:3000`,
		],
		HostConfig: {
			LogConfig: {
				Type: 'local',
				Config: {},
			},
			NetworkMode: isLinux ? 'host' : 'bridge',
			// NetworkMode: 'host',
		},
	});

	await container.start({});

	await attachLogs(container);
};

const getContainer = async (name: string) => {
	const docker = new Docker();
	const containers = await docker.listContainers({ all: true });
	const containerInfo = containers.find(c => c.Names.includes(`/${name}`));

	if (!containerInfo) {
		console.log('Container not found:');
		return { container: null, state: null };
	}

	return { container: docker.getContainer(containerInfo.Id), state: containerInfo.State };
};

export const removeProbeContainer = async () => {
	const { container } = await getContainer('globalping-probe-e2e');

	if (!container) {
		return;
	}

	await container.remove({ force: true });
};

export const removeApiContainer = async () => {
	const { container } = await getContainer('globalping-api-e2e');

	if (!container) {
		return;
	}

	await container.remove({ force: true });
};

export const stopProbeContainer = async () => {
	const { container, state } = await getContainer('globalping-probe-e2e');

	if (!container || state === 'exited') {
		return;
	}

	await container.stop();
};

export const startProbeContainer = async () => {
	const { container, state } = await getContainer('globalping-probe-e2e');

	if (!container || state === 'running') {
		return;
	}

	await container.start({});
};

await createApiContainer();
await createProbeContainer();
