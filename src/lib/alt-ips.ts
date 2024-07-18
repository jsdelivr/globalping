import { randomUUID } from 'node:crypto';
import { getSyncedProbeList, type ServerSocket } from './ws/server.js';
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
	reqMessageId: string;
};

export class AltIps {
	private readonly tokenToSocket: TTLCache<string, ServerSocket> = new TTLCache<string, ServerSocket>({ ttl: 5 * 60 * 1000 });
	private readonly pendingRequests: Map<string, (value: void | PromiseLike<void>) => void> = new Map();

	constructor (private readonly syncedProbeList: SyncedProbeList) {
		this.subscribeToNodeMessages();
	}

	generateToken (socket: ServerSocket) {
		const token = randomUUID();
		this.tokenToSocket.set(token, socket);
		return { token, socketId: socket.id };
	}

	async validateTokenFromHttp (request: AltIpReqBody) {
		await this.syncedProbeList.fetchProbes(); // This refreshes the probes list

		const duplicateProbe = this.syncedProbeList.getProbeByIp(request.ip);

		if (duplicateProbe && duplicateProbe.client !== request.socketId) {
			logger.warn(`Probe with ip ${request.ip} is already connected. Ignoring an alternative ip ${request.ip} for the socket ${request.socketId}`);
			throw createHttpError(400, 'Another probe with that ip is already connected.', { type: 'alt_ip_duplication' });
		}

		if (duplicateProbe && duplicateProbe.client === request.socketId) {
			return;
		}

		const localSocket = this.tokenToSocket.get(request.token);

		if (localSocket && localSocket.data.probe.altIpAddresses.includes(request.ip)) {
			return;
		} else if (localSocket) {
			localSocket.data.probe.altIpAddresses.push(request.ip);
			return;
		}

		const nodeId = this.syncedProbeList.getNodeIdBySocketId(request.socketId);

		if (nodeId) {
			const id = await this.syncedProbeList.publishToNode<AltIpReqBody>(nodeId, ALT_IP_REQ_MESSAGE_TYPE, request);
			await this.getResponsePromise(id);
		} else {
			throw createHttpError(400, 'Unable to find a probe by specified socketId', { type: 'probe_not_found' });
		}
	}

	private getResponsePromise (messageId: string) {
		const promise = new Promise<void>((resolve, reject) => {
			this.pendingRequests.set(messageId, resolve);

			setTimeout(() => {
				this.pendingRequests.delete(messageId);
				logger.error(`Node failed to handle alt ip message in specified timeout.`);
				reject(createHttpError(504, 'Node owning the probe failed to handle alt ip in specified timeout.', { type: 'node_response_timeout' }));
			}, 15000);
		});
		return promise;
	}

	private validateTokenFromPubSub = async (reqMessage: PubSubMessage<AltIpReqBody>) => {
		const localSocket = this.tokenToSocket.get(reqMessage.body.token);

		if (localSocket && !localSocket.data.probe.altIpAddresses.includes(reqMessage.body.token)) {
			localSocket.data.probe.altIpAddresses.push(reqMessage.body.ip);
		}

		await this.syncedProbeList.publishToNode<AltIpResBody>(reqMessage.reqNodeId, ALT_IP_RES_MESSAGE_TYPE, { result: 'success', reqMessageId: reqMessage.id });
	};

	private handleRes = async (resMessage: PubSubMessage<AltIpResBody>) => {
		const resolve = this.pendingRequests.get(resMessage.body.reqMessageId);

		if (resolve) {
			resolve();
		}
	};

	private async subscribeToNodeMessages () {
		await this.syncedProbeList.subscribeToNodeMessages<AltIpReqBody>(ALT_IP_REQ_MESSAGE_TYPE, this.validateTokenFromPubSub);
		await this.syncedProbeList.subscribeToNodeMessages<AltIpResBody>(ALT_IP_RES_MESSAGE_TYPE, this.handleRes);
	}
}

let altIpsClient: AltIps;

export const getAltIpsClient = () => {
	if (!altIpsClient) {
		altIpsClient = new AltIps(getSyncedProbeList());
	}

	return altIpsClient;
};
