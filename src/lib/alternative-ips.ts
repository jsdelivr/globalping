import { randomUUID } from 'node:crypto';
import type { RedisClient } from './redis/shared.js';
import type { ServerSocket, WsServer } from './ws/server.js';
import type { SyncedProbeList } from './ws/synced-probe-list.js';
import TTLCache from '@isaacs/ttlcache';
import type { AlternativeIpRequest } from '../alternative-ip/types.js';

export class AlternativeIps {
	private readonly tokenToSocket: TTLCache<string, ServerSocket>;

	constructor (
		private readonly redis: RedisClient,
		private readonly syncedProbeList: SyncedProbeList,
		private readonly io: WsServer,
	) {
		this.tokenToSocket = new TTLCache<string, ServerSocket>({ ttl: 5 * 60 * 1000 });
	}

	generateToken (socket: ServerSocket) {
		const token = randomUUID();
		this.tokenToSocket.set(token, socket);
		console.log('token', token);
	}

	async validateToken (request: AlternativeIpRequest) {
		const localSocket = this.tokenToSocket.get(request.socketId);

		if (localSocket) {
		}
	}
}
