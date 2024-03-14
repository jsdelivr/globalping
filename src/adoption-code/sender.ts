import createHttpError from 'http-errors';
import { fetchProbes as serverFetchProbes, getWsServer, PROBES_NAMESPACE, type WsServer } from '../lib/ws/server.js';
import type { AdoptionCodeRequest } from './types.js';
import type { Probe } from '../probe/types.js';

export class CodeSender {
	constructor (private readonly io: WsServer, private readonly fetchProbes: typeof serverFetchProbes) {}

	async sendCode (request: AdoptionCodeRequest): Promise<Probe> {
		const probe = await this.findSocketByIp(request.ip);

		if (!probe) {
			throw createHttpError(422, 'No suitable probes found.', { type: 'no_probes_found' });
		}

		this.sendToProbe(probe, request.code);

		return probe;
	}

	private async findSocketByIp (ip: string) {
		const probes = await this.fetchProbes();
		return probes.find(probe => probe.ipAddress === ip);
	}

	private sendToProbe (probe: Probe, code: string) {
		this.io.of(PROBES_NAMESPACE).to(probe.client).emit('probe:adoption:code', {
			code,
		});
	}
}

export const codeSender = new CodeSender(getWsServer(), serverFetchProbes);
