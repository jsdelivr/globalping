import { randomUUID } from 'node:crypto';
import type { ServerSocket } from './ws/server.js';
import type { PubSubMessage, SyncedProbeList } from './ws/synced-probe-list.js';
import TTLCache from '@isaacs/ttlcache';
import createHttpError from 'http-errors';
import { scopedLogger } from './logger.js';


const logger = scopedLogger('alt-ips');

const ALT_IP_REQ_MESSAGE_TYPE = 'alt-ip:req';
const ALT_IP_RES_MESSAGE_TYPE = 'alt-ip:res';

export type AltIpReqBody = {
	socketId: string;
	ip: string;
	token: string;
};

export type AltIpResBody = {
	result: 'success';
	reqId: string;
};

export class AltIps {
	private readonly tokenToSocket: TTLCache<string, ServerSocket>;

	constructor (private readonly syncedProbeList: SyncedProbeList) {
		this.tokenToSocket = new TTLCache<string, ServerSocket>({ ttl: 5 * 60 * 1000 });
		this.subscribeToNodeMessages();
	}

	generateToken (socket: ServerSocket) {
		const token = randomUUID();
		console.log('generateToken', token);
		this.tokenToSocket.set(token, socket);
		return { token, socketId: socket.id };
	}

	async validateTokenFromHttp (request: AltIpReqBody) {
		console.log('validateTokenFromHttp');
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
			await this.syncedProbeList.publishToNode<AltIpReqBody>(nodeId, ALT_IP_REQ_MESSAGE_TYPE, request);
			// await this.getResponsePromise()
		}
	}

	private validateTokenFromPubSub = async (reqMessage: PubSubMessage<AltIpReqBody>) => {
		console.log('validateTokenFromPubSub');
		console.log('reqMessage', reqMessage);
		const localSocket = this.tokenToSocket.get(reqMessage.body.token);

		if (localSocket && localSocket.data.probe.altIpAddresses.includes(reqMessage.body.token)) {
			return;
		}

		if (localSocket) {
			localSocket.data.probe.altIpAddresses.push(reqMessage.body.ip);
			await this.syncedProbeList.publishToNode<AltIpResBody>(reqMessage.reqNodeId, ALT_IP_RES_MESSAGE_TYPE, { result: 'success', reqId: reqMessage.id });
		}
	};

	private handleRes = async (resMessage: PubSubMessage<AltIpResBody>) => {
		console.log('resMessage', resMessage);
	};

	private async subscribeToNodeMessages () {
		await this.syncedProbeList.subscribeToNodeMessages<AltIpReqBody>(ALT_IP_REQ_MESSAGE_TYPE, this.validateTokenFromPubSub);
		await this.syncedProbeList.subscribeToNodeMessages<AltIpResBody>(ALT_IP_RES_MESSAGE_TYPE, this.handleRes);
	}
}
