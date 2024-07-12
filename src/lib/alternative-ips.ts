import { randomUUID } from 'node:crypto';
import type { ServerSocket } from './ws/server.js';
import type { SyncedProbeList } from './ws/synced-probe-list.js';
import TTLCache from '@isaacs/ttlcache';
import type { AlternativeIpRequest } from '../alternative-ip/types.js';

const ALT_IP_MESSAGE_TYPE = 'alternative-ip';

export type AltIpMessage = {
	type: typeof ALT_IP_MESSAGE_TYPE,
	body: {
		socketId: string;
		ip: string;
		token: string;
	};
}

export class AlternativeIps {
	private readonly tokenToSocket: TTLCache<string, ServerSocket>;

	constructor (private readonly syncedProbeList: SyncedProbeList) {
		this.tokenToSocket = new TTLCache<string, ServerSocket>({ ttl: 5 * 60 * 1000 });
		this.subscribeToNodeMessages();
	}

	generateToken (socket: ServerSocket) {
		const token = randomUUID();
		this.tokenToSocket.set(token, socket);
		console.log('socket.id', socket.id);
		console.log('token', token);
	}

	async validateTokenFromHttp (request: AlternativeIpRequest) {
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
