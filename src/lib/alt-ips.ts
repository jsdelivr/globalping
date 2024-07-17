import { randomUUID } from 'node:crypto';
import type { ServerSocket } from './ws/server.js';
import type { SyncedProbeList } from './ws/synced-probe-list.js';
import TTLCache from '@isaacs/ttlcache';
import createHttpError from 'http-errors';
import { scopedLogger } from './logger.js';


const logger = scopedLogger('alt-ips');

const ALT_IP_REQ_MESSAGE_TYPE = 'alt-ip:req';
const ALT_IP_RES_MESSAGE_TYPE = 'alt-ip:res';

export type AltIpReqMessage = {
	type: typeof ALT_IP_REQ_MESSAGE_TYPE,
	body: {
		socketId: string;
		ip: string;
		token: string;
	};
};

export type AltIpResMessage = {
	type: typeof ALT_IP_RES_MESSAGE_TYPE,
	body: {
		result: 'success',
		type: 'success'
	};
};

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

	async validateTokenFromHttp (request: AltIpReqMessage['body']) {
		await this.syncedProbeList.fetchProbes(); // This refreshes the probes list

		const duplicateProbe = this.syncedProbeList.getProbeByIp(request.ip);

		if (duplicateProbe && duplicateProbe.client !== request.socketId) {
			logger.warn(`Probe with ip ${request.ip} is already connected. Ignoring an alternative ip ${request.ip} for the socket ${request.socketId}`);
			throw createHttpError(400, 'Another probe with ip is already connected', { type: 'alt_ip_duplication' });
		}

		if (duplicateProbe && duplicateProbe.client === request.socketId) {
			return;
		}

		const localSocket = this.tokenToSocket.get(request.token);

		if (localSocket && localSocket.data.probe.altIpAddresses.includes(request.ip)) {
			return;
		}

		if (localSocket) {
			localSocket.data.probe.altIpAddresses.push(request.ip);
			return;
		}

		const nodeId = this.syncedProbeList.getNodeIdBySocketId(request.socketId);

		if (nodeId) {
			const message: AltIpReqMessage = {
				type: ALT_IP_REQ_MESSAGE_TYPE,
				body: request,
			};
			await this.syncedProbeList.publishToNode(nodeId, message);
		}
	}

	private validateTokenFromPubSub = async (reqMessage: AltIpReqMessage, nodeId: string) => {
		const localSocket = this.tokenToSocket.get(reqMessage.body.token);

		if (localSocket && localSocket.data.probe.altIpAddresses.includes(reqMessage.body.token)) {
			return;
		}

		if (localSocket) {
			localSocket.data.probe.altIpAddresses.push(reqMessage.body.ip);
			const resMessage: AltIpResMessage = {
				type: ALT_IP_RES_MESSAGE_TYPE,
				body: { result: 'success', type: 'success' },
			};
			await this.syncedProbeList.publishToNode(nodeId, resMessage);
		}
	};

	private handleRes = async (resMessage: AltIpResMessage) => {
		console.log('resMessage', resMessage);
	};

	private async subscribeToNodeMessages () {
		await this.syncedProbeList.subscribeToNodeMessages<AltIpReqMessage>(ALT_IP_REQ_MESSAGE_TYPE, this.validateTokenFromPubSub);
		await this.syncedProbeList.subscribeToNodeMessages<AltIpResMessage>(ALT_IP_RES_MESSAGE_TYPE, this.handleRes);
	}
}
