import type { Probe } from '../../probe/types.js';

type Info = {
	socketId: string;
	ipAddress: string;
	// A string used for message parsing
	code?: string;
	probe?: Probe;
	cause?: unknown;
};

type JsonResponse = {
	message: string;
	info: Info;
};

export class WsError extends Error {
	info: Info;
	constructor (message: string, info: Info) {
		super(message);
		this.info = info;
	}

	toJson (): JsonResponse {
		return {
			message: this.message,
			info: this.info,
		};
	}
}

export default WsError;
