import { randomUUID } from 'node:crypto';
import type { ServerSocket } from './ws/server.js';
import type { SyncedProbeList } from './ws/synced-probe-list.js';
import TTLCache from '@isaacs/ttlcache';
import createHttpError from 'http-errors';
import { scopedLogger } from './logger.js';


const logger = scopedLogger('alt-ips');

const ALT_IP_MESSAGE_TYPE = 'alternative-ip';

export type AltIpMessage = {
	type: typeof ALT_IP_MESSAGE_TYPE,
	body: {
		socketId: string;
		ip: string;
		token: string;
	};
}

export class AltIps {
	private readonly tokenToSocket: TTLCache<string, ServerSocket>;

	constructor (private readonly syncedProbeList: SyncedProbeList) {
		this.tokenToSocket = new TTLCache<string, ServerSocket>({ ttl: 5 * 60 * 1000 });
		this.subscribeToNodeMessages();
	}

	generateToken (socket: ServerSocket) {
		const token = randomUUID();
		this.tokenToSocket.set(token, socket);
		return { token, socketId: socket.id };
	}

	async validateTokenFromHttp (request: AltIpMessage['body']) {
		await this.syncedProbeList.fetchProbes(); // This refreshes the probes list

		const duplicateProbe = this.syncedProbeList.getProbeByIp(request.ip);

		if (duplicateProbe && duplicateProbe.client !== request.socketId) {
			logger.warn(`Probe with ip ${request.ip} is already connected. Ignoring an alternative ip ${request.ip} for the socket ${request.socketId}`);
			throw createHttpError(400, 'Probe with ip is already connected', { type: 'alt_ip_duplication' });
		} else if (duplicateProbe) {
			logger.warn(`Probe ${request.socketId} already has ip ${request.ip}`);
			return;
		}

		const localSocket = this.tokenToSocket.get(request.token);

		if (localSocket) {
			localSocket.data.probe.altIpAddresses.push(request.ip);
			return;
		}

		const nodeId = this.syncedProbeList.getNodeIdBySocketId(request.socketId);

		if (nodeId) {
			const message: AltIpMessage = {
				type: ALT_IP_MESSAGE_TYPE,
				body: request,
			};
			await this.syncedProbeList.publishToNode(nodeId, message);
		}
	}

	validateTokenFromPubSub = (message: AltIpMessage) => {
		const localSocket = this.tokenToSocket.get(message.body.token);

		if (localSocket) {
			localSocket.data.probe.altIpAddresses.push(message.body.ip);
		}
	};

	private async subscribeToNodeMessages () {
		await this.syncedProbeList.subscribeToNodeMessages<AltIpMessage>(ALT_IP_MESSAGE_TYPE, this.validateTokenFromPubSub);
	}
}
