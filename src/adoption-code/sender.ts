
import createHttpError from 'http-errors';
import type { RemoteProbeSocket } from '../lib/ws/server.js';
import { fetchSockets } from '../lib/ws/fetch-sockets.js';
import type { AdoptionCodeRequest } from './types.js';

export class CodeSender {
	constructor (private readonly fetchWsSockets: typeof fetchSockets) {}

	async sendCode (request: AdoptionCodeRequest): Promise<RemoteProbeSocket> {
		const socket = await this.findSocketByIp(request.ip);

		if (!socket) {
			throw createHttpError(422, 'No suitable probes found.', { type: 'no_probes_found' });
		}

		this.sendToSocket(socket, request.code);

		return socket;
	}

	private async findSocketByIp (ip: string) {
		const sockets = await this.fetchWsSockets();
		return sockets.find(socket => socket.data.probe.ipAddress === ip);
	}

	private sendToSocket (socket: RemoteProbeSocket, code: string) {
		socket.emit('probe:adoption:code', {
			code,
		});
	}
}

export const codeSender = new CodeSender(fetchSockets);
