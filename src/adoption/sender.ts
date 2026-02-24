import createHttpError from 'http-errors';
import { PROBES_NAMESPACE, type WsServer } from '../lib/ws/server.js';
import type { AdoptionCodeRequest } from './types.js';
import type { IoContext } from '../lib/server.js';
import type { ServerProbe } from '../probe/types.js';

export class CodeSender {
	constructor (
		private readonly io: WsServer,
		private readonly getProbeByIp: IoContext['getProbeByIp'],
	) {}

	async sendCode (request: AdoptionCodeRequest) {
		const probe = await this.getProbeByIp(request.ip);

		if (!probe) {
			throw createHttpError(422, 'No matching probes found.', { type: 'no_probes_found' });
		}

		this.sendToProbe(probe, request.code);

		return probe;
	}

	private sendToProbe (probe: ServerProbe, code: string) {
		this.io.of(PROBES_NAMESPACE).to(probe.client).emit('probe:adoption:code', {
			code,
		});
	}
}

export const initCodeSender = (io: WsServer, getProbeByIp: IoContext['getProbeByIp']) => {
	return new CodeSender(io, getProbeByIp);
};
