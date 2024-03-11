import Docker from 'dockerode';
import { scopedLogger } from '../src/lib/logger.js';

const logger = scopedLogger('docker-manager');

class DockerManager {
	docker: Docker;

	constructor () {
		this.docker = new Docker();
	}

	public async createApiContainer () {
		const isLinux = await this.isLinuxHost();
		const container = await this.docker.createContainer({
			Image: 'globalping-api-e2e',
			name: 'globalping-api-e2e',
			Env: [
				'NODE_ENV=test',
				'TEST_MODE=e2e',
				'NEW_RELIC_ENABLED=false',
				`REDIS_URL=redis://${isLinux ? 'localhost' : 'host.docker.internal'}:6379`,
				`DB_CONNECTION_HOST=${isLinux ? 'localhost' : 'host.docker.internal'}`,
			],
			HostConfig: {
				PortBindings: {
					'80/tcp': [{ HostPort: '80' }],
				},
				NetworkMode: isLinux ? 'host' : 'bridge',
			},
		});

		await container.start({});
		await this.attachLogs(container);
	}

	public async createProbeContainer () {
		const isLinux = await this.isLinuxHost();
		const container = await this.docker.createContainer({
			Image: 'ghcr.io/jsdelivr/globalping-probe',
			name: 'globalping-probe-e2e',
			Env: [
				`API_HOST=ws://${isLinux ? 'localhost' : 'host.docker.internal'}:80`,
			],
			HostConfig: {
				LogConfig: {
					Type: 'local',
					Config: {},
				},
				NetworkMode: isLinux ? 'host' : 'bridge',
			},
		});

		await container.start({});
		await this.attachLogs(container);
	}

	public async removeProbeContainer () {
		const { container } = await this.getContainer('globalping-probe-e2e');

		if (!container) {
			return;
		}

		await container.remove({ force: true });
	}

	public async removeApiContainer () {
		const { container } = await this.getContainer('globalping-api-e2e');

		if (!container) {
			return;
		}

		await container.remove({ force: true });
	}

	public async stopProbeContainer () {
		const { container, state } = await this.getContainer('globalping-probe-e2e');

		if (!container || state === 'exited') {
			return;
		}

		await container.stop();
	}

	public async startProbeContainer () {
		const { container, state } = await this.getContainer('globalping-probe-e2e');

		if (!container || state === 'running') {
			return;
		}

		await container.start({});
	}

	private async isLinuxHost (): Promise<boolean> {
		const versionInfo = await this.docker.version();
		const platformName = versionInfo.Platform.Name.toLowerCase();
		return platformName.includes('engine');
	}

	private async attachLogs (container: Docker.Container) {
		const stream = await container.logs({
			follow: true,
			stdout: true,
			stderr: true,
		});
		container.modem.demuxStream(stream, process.stdout, process.stderr);
	}

	private async getContainer (name: string): Promise<{ container: Docker.Container | null, state: string | null }> {
		const containers = await this.docker.listContainers({ all: true });
		const containerInfo = containers.find(c => c.Names.includes(`/${name}`));

		if (!containerInfo) {
			logger.warn('Container not found:');
			return { container: null, state: null };
		}

		return { container: this.docker.getContainer(containerInfo.Id), state: containerInfo.State };
	}
}

export const docker = new DockerManager();
