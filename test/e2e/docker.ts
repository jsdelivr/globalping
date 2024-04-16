import Docker from 'dockerode';
import config from 'config';

import { scopedLogger } from '../../src/lib/logger.js';

const logger = scopedLogger('docker-manager');

class DockerManager {
	docker: Docker;

	private lastLogTimestamp: number = 0;

	constructor () {
		this.docker = new Docker();
	}

	public async createApiContainer () {
		const redisUrl = config.get<string>('redis.url').replace('localhost', 'host.docker.internal');
		const dbConnectionHost = config.get<string>('db.connection.host').replace('localhost', 'host.docker.internal');
		const processes = config.get<string>('server.processes');

		// docker run -e NODE_ENV=test -e TEST_MODE=e2e -e NEW_RELIC_ENABLED=false -e REDIS_URL=redis://host.docker.internal:6379 -e DB_CONNECTION_HOST=host.docker.internal --name globalping-api-e2e globalping-api-e2e
		const container = await this.docker.createContainer({
			Image: 'globalping-api-e2e',
			name: 'globalping-api-e2e',
			Env: [
				'NODE_ENV=test',
				'TEST_MODE=e2e',
				'NEW_RELIC_ENABLED=false',
				`REDIS_URL=${redisUrl}`,
				`DB_CONNECTION_HOST=${dbConnectionHost}`,
				`SERVER_PROCESSES=${processes}`,
			],
			HostConfig: {
				PortBindings: {
					'80/tcp': [{ HostPort: '80' }],
				},
				ExtraHosts: [ 'host.docker.internal:host-gateway' ],
			},
		});

		await container.start({});
		await this.attachLogs(container);
	}

	public async createProbeContainer () {
		// docker run -e API_HOST=ws://host.docker.internal:80 --name globalping-probe-e2e globalping-probe-e2e
		const container = await this.docker.createContainer({
			Image: 'globalping-probe-e2e',
			name: 'globalping-probe-e2e',
			Env: [
				'API_HOST=ws://host.docker.internal:80',
			],
			HostConfig: {
				ExtraHosts: [ 'host.docker.internal:host-gateway' ],
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
		await this.attachLogs(container);
	}

	private async attachLogs (container: Docker.Container) {
		const stream = await container.logs({
			follow: true,
			stdout: true,
			stderr: true,
			since: this.lastLogTimestamp,
		});
		stream.on('close', () => this.lastLogTimestamp = Math.floor(Date.now() / 1000));

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
