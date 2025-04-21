import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { getSyncedProbeList, type ServerSocket } from './ws/server.js';
import type { PubSubMessage, SyncedProbeList } from './ws/synced-probe-list.js';
import TTLCache from '@isaacs/ttlcache';
import createHttpError from 'http-errors';
import { scopedLogger } from './logger.js';
import GeoIpClient, { getGeoIpClient } from './geoip/client.js';
import { isIpPrivate } from './private-ip.js';
import { ProbeError } from './probe-error.js';
import { isIpBlocked } from './blocked-ip-ranges.js';

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
	result: 'probe-not-found';
	reqMessageId: string;
} | {
	result: 'invalid-alt-ip';
	reqMessageId: string;
};

export class AltIps {
	private readonly tokenToSocket: TTLCache<string, ServerSocket> = new TTLCache<string, ServerSocket>({ ttl: 5 * 60 * 1000 });
	private readonly pendingRequests: Map<string, (value: AltIpResBody) => void> = new Map();

	constructor (
		private readonly syncedProbeList: SyncedProbeList,
		private readonly geoIpClient: GeoIpClient,
	) {
		this.subscribeToNodeMessages();
	}

	async generateToken (socket: ServerSocket) {
		const bytes = await getRandomBytes(24);
		const token = bytes.toString('base64');
		this.tokenToSocket.set(token, socket);
		return token;
	}

	async validateTokenFromHttp (request: AltIpReqBody) {
		// Refresh the probes list.
		await this.syncedProbeList.fetchProbes();

		const nodeId = this.syncedProbeList.getNodeIdBySocketId(request.socketId);

		if (!nodeId) {
			throw createHttpError(400, 'Unable to find a probe by specified socket id.', { type: 'probe_not_found' });
		}

		const duplicateProbe = this.syncedProbeList.getProbeByIp(request.ip);

		if (duplicateProbe && duplicateProbe.client !== request.socketId) {
			logger.warn(`Probe with ip ${request.ip} is already connected. Ignoring an alternative ip ${request.ip} for the socket ${request.socketId}`);
			throw createHttpError(400, 'Another probe with this ip is already connected.', { type: 'alt_ip_duplication' });
		}

		if (duplicateProbe && duplicateProbe.client === request.socketId) {
			return;
		}

		// First case - the socket is directly on this node.
		const localSocket = this.tokenToSocket.get(request.token);

		if (localSocket) {
			const isAdded = await this.addAltIp(localSocket, request.ip);

			if (!isAdded) {
				throw createHttpError(400, 'Alt IP is invalid.', { type: 'invalid_alt_ip' });
			}

			return;
		}

		if (nodeId === this.syncedProbeList.getNodeId()) {
			throw createHttpError(400, 'Token value is wrong.', { type: 'wrong_token' });
		}

		// Second case - the socket is on a different node, need to perform a remote update.
		const id = await this.syncedProbeList.publishToNode<AltIpReqBody>(nodeId, ALT_IP_REQ_MESSAGE_TYPE, request);
		const response: AltIpResBody = await this.getResponsePromise(id, nodeId, request);

		if (response.result === 'probe-not-found') {
			throw createHttpError(400, 'Unable to find a probe on the remote node.', { type: 'probe_not_found_on_remote' });
		} else if (response.result === 'invalid-alt-ip') {
			throw createHttpError(400, 'Alt IP is invalid.', { type: 'invalid_alt_ip' });
		}
	}

	private getResponsePromise (messageId: string, nodeId: string, request: AltIpReqBody) {
		const promise = new Promise<AltIpResBody>((resolve, reject) => {
			this.pendingRequests.set(messageId, resolve);

			setTimeout(() => {
				this.pendingRequests.delete(messageId);
				reject(createHttpError(504, 'Node owning the probe failed to handle alt ip in specified timeout.', { type: 'node_response_timeout' }));
			}, 20_000);
		}).catch((err) => {
			logger.warn(`Node ${nodeId} failed to handle alt ip ${request.ip} for socket ${request.socketId} in specified timeout.`);
			throw err;
		});
		return promise;
	}

	async validateTokenFromPubSub (reqMessage: PubSubMessage<AltIpReqBody>) {
		const localSocket = this.tokenToSocket.get(reqMessage.body.token);

		if (!localSocket) {
			await this.syncedProbeList.publishToNode<AltIpResBody>(reqMessage.reqNodeId, ALT_IP_RES_MESSAGE_TYPE, { result: 'probe-not-found', reqMessageId: reqMessage.id });
			return;
		}

		const isAdded = await this.addAltIp(localSocket, reqMessage.body.ip);

		if (!isAdded) {
			await this.syncedProbeList.publishToNode<AltIpResBody>(reqMessage.reqNodeId, ALT_IP_RES_MESSAGE_TYPE, { result: 'invalid-alt-ip', reqMessageId: reqMessage.id });
		} else {
			await this.syncedProbeList.publishToNode<AltIpResBody>(reqMessage.reqNodeId, ALT_IP_RES_MESSAGE_TYPE, { result: 'success', reqMessageId: reqMessage.id });
		}
	}

	handleRes = (resMessage: PubSubMessage<AltIpResBody>) => {
		const resolve = this.pendingRequests.get(resMessage.body.reqMessageId);
		this.pendingRequests.delete(resMessage.body.reqMessageId);

		if (resolve) {
			resolve(resMessage.body);
		}
	};

	/**
	 * @returns was alt IP added.
	 */
	private async addAltIp (localSocket: ServerSocket, altIp: string): Promise<boolean> {
		const probeInfo = { probeIp: localSocket.data.probe.ipAddress, probeLocation: localSocket.data.probe.location };

		if (process.env['FAKE_PROBE_IP']) {
			return false;
		}

		if (isIpPrivate(altIp)) {
			logger.warn('Alt IP is private.', { altIp });
			return false;
		}

		if (isIpBlocked(altIp)) {
			logger.warn('Alt IP is blocked.', { altIp });
			return false;
		}

		try {
			const altIpInfo = await this.geoIpClient.lookup(altIp);

			if (altIpInfo.country !== localSocket.data.probe.location.country) {
				logger.warn('Alt IP country doesn\'t match the probe country.', { altIp, altIpInfo, ...probeInfo });
				return false;
			}

			if (altIpInfo.isAnycast) {
				logger.warn('Alt IP is anycast.', { altIp, altIpInfo, ...probeInfo });
				return false;
			}
		} catch (e) {
			if (e instanceof ProbeError) {
				logger.warn('Failed to add an alt IP.', e, { altIp, ...probeInfo });
			} else {
				logger.error('Failed to add an alt IP.', e, { altIp, ...probeInfo });
			}

			return false;
		}

		if (localSocket.data.probe.ipAddress === altIp || localSocket.data.probe.altIpAddresses.includes(altIp)) {
			return true;
		}

		localSocket.data.probe.altIpAddresses.push(altIp);
		return true;
	}

	private subscribeToNodeMessages () {
		this.syncedProbeList.subscribeToNodeMessages<AltIpReqBody>(ALT_IP_REQ_MESSAGE_TYPE, (reqMessage: PubSubMessage<AltIpReqBody>) => {
			this.validateTokenFromPubSub(reqMessage).catch(error => logger.error('Failed to validate token from pub/sub.', error));
		});

		this.syncedProbeList.subscribeToNodeMessages<AltIpResBody>(ALT_IP_RES_MESSAGE_TYPE, this.handleRes);
	}
}

let altIpsClient: AltIps;

export const getAltIpsClient = () => {
	if (!altIpsClient) {
		altIpsClient = new AltIps(getSyncedProbeList(), getGeoIpClient());
	}

	return altIpsClient;
};
