
import createHttpError from 'http-errors';
import { fetchSockets, ProbeSocket } from '../lib/ws/server.js';
import type { AdoptionCodeRequest } from './types.js';

export class CodeSender {
	constructor (private readonly fetchWsSockets: typeof fetchSockets) {}

	async sendCode (request: AdoptionCodeRequest): Promise<string> {
		const socket = await this.findSocketByIp(request.ip);

		if (!socket) {
			throw createHttpError(422, 'No suitable probes found.', { type: 'no_probes_found' });
		}

		this.sendToSocket(socket, request.code);

		return 'Code was sent to the probe.';
	}

	private async findSocketByIp (ip: string) {
		const sockets = await this.fetchWsSockets();
		return sockets.find(socket => socket.data.probe.ipAddress === ip);
	}

	private sendToSocket (sockets: ProbeSocket, code: string) {
		sockets.emit('probe:adoption:code', {
			code,
		});
	}
}

export const codeSender = new CodeSender(fetchSockets);
