import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { getSyncedProbeList, type ServerSocket } from './ws/server.js';
import type { PubSubMessage, SyncedProbeList } from './ws/synced-probe-list.js';
import TTLCache from '@isaacs/ttlcache';
import createHttpError from 'http-errors';
import { scopedLogger } from './logger.js';

const getRandomBytes = promisify(randomBytes);
const logger = scopedLogger('alt-ips');

export const ALT_IP_REQ_MESSAGE_TYPE = 'alt-ip:req';
export const ALT_IP_RES_MESSAGE_TYPE = 'alt-ip:res';

export type AltIpReqBody = {
	socketId: string;
	ip: string;
	token: string;
};

export type AltIpResBody = {
	result: 'success';
	reqMessageId: string;
} | {
	result: 'probe-not-found',
	reqMessageId: string;
};

export class AltIps {
	private readonly tokenToSocket: TTLCache<string, ServerSocket> = new TTLCache<string, ServerSocket>({ ttl: 5 * 60 * 1000 });
	private readonly pendingRequests: Map<string, (value: AltIpResBody) => void> = new Map();

	constructor (private readonly syncedProbeList: SyncedProbeList) {
		this.subscribeToNodeMessages();
	}

	async generateToken (socket: ServerSocket) {
		const bytes = await getRandomBytes(24);
		const token = bytes.toString('base64');
		this.tokenToSocket.set(token, socket);
		return token;
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

		// Simple case - the socket is directly on this node
		const localSocket = this.tokenToSocket.get(request.token);

		if (localSocket && localSocket.data.probe.altIpAddresses.includes(request.ip)) {
			return;
		} else if (localSocket) {
			localSocket.data.probe.altIpAddresses.push(request.ip);
			return;
		}

		// The socket is on a different node, need to perform a remote update.
		const nodeId = this.syncedProbeList.getNodeIdBySocketId(request.socketId);

		if (nodeId === this.syncedProbeList.getNodeId()) {
			throw createHttpError(400, 'Token value is wrong.', { type: 'wrong_token' });
		} else if (nodeId) {
			const id = await this.syncedProbeList.publishToNode<AltIpReqBody>(nodeId, ALT_IP_REQ_MESSAGE_TYPE, request);
			const response: AltIpResBody = await this.getResponsePromise(id);

			if (response.result === 'probe-not-found') {
				throw createHttpError(400, 'Unable to find a probe on the remote node.', { type: 'probe_not_found_on_remote' });
			}
		} else {
			throw createHttpError(400, 'Unable to find a probe by specified socketId.', { type: 'probe_not_found' });
		}
	}

	private getResponsePromise (messageId: string) {
		const promise = new Promise<AltIpResBody>((resolve, reject) => {
			this.pendingRequests.set(messageId, resolve);

			setTimeout(() => {
				this.pendingRequests.delete(messageId);
				reject(createHttpError(504, 'Node owning the probe failed to handle alt ip in specified timeout.', { type: 'node_response_timeout' }));
			}, 15000);
		}).catch((err) => {
			logger.error(`Node failed to handle alt ip message ${messageId} in specified timeout.`);
			throw err;
		});
		return promise;
	}

	validateTokenFromPubSub = (reqMessage: PubSubMessage<AltIpReqBody>) => {
		(async () => {
			const localSocket = this.tokenToSocket.get(reqMessage.body.token);

			if (!localSocket) {
				await this.syncedProbeList.publishToNode<AltIpResBody>(reqMessage.reqNodeId, ALT_IP_RES_MESSAGE_TYPE, { result: 'probe-not-found', reqMessageId: reqMessage.id });
				return;
			}

			if (!localSocket.data.probe.altIpAddresses.includes(reqMessage.body.ip)) {
				localSocket.data.probe.altIpAddresses.push(reqMessage.body.ip);
			}

			await this.syncedProbeList.publishToNode<AltIpResBody>(reqMessage.reqNodeId, ALT_IP_RES_MESSAGE_TYPE, { result: 'success', reqMessageId: reqMessage.id });
		})().catch(error => logger.error(error));
	};

	handleRes = (resMessage: PubSubMessage<AltIpResBody>) => {
		const resolve = this.pendingRequests.get(resMessage.body.reqMessageId);
		this.pendingRequests.delete(resMessage.body.reqMessageId);

		if (resolve) {
			resolve(resMessage.body);
		}
	};

	private subscribeToNodeMessages () {
		this.syncedProbeList.subscribeToNodeMessages<AltIpReqBody>(ALT_IP_REQ_MESSAGE_TYPE, this.validateTokenFromPubSub);
		this.syncedProbeList.subscribeToNodeMessages<AltIpResBody>(ALT_IP_RES_MESSAGE_TYPE, this.handleRes);
	}
}

let altIpsClient: AltIps;

export const getAltIpsClient = () => {
	if (!altIpsClient) {
		altIpsClient = new AltIps(getSyncedProbeList());
	}

	return altIpsClient;
};
