import createHttpError from 'http-errors';
import { getProbeByIp as serverGetProbeByIp, getWsServer, PROBES_NAMESPACE, type WsServer } from '../lib/ws/server.js';
import type { AdoptionCodeRequest } from './types.js';
import type { Probe } from '../probe/types.js';

export class CodeSender {
	constructor (
		private readonly io: WsServer,
		private readonly getProbeByIp: typeof serverGetProbeByIp,
	) {}

	async sendCode (request: AdoptionCodeRequest) {
		const probe = await this.getProbeByIp(request.ip);

		if (!probe) {
			throw createHttpError(422, 'No suitable probes found.', { type: 'no_probes_found' });
		}

		this.sendToProbe(probe, request.code);

		return probe;
	}

	private sendToProbe (probe: Probe, code: string) {
		this.io.of(PROBES_NAMESPACE).to(probe.client).emit('probe:adoption:code', {
			code,
		});
	}
}

export const codeSender = new CodeSender(getWsServer(), serverGetProbeByIp);
