import cluster, { type Worker } from 'node:cluster';
import { scopedLogger } from '../logger.js';
import { creditsMaster } from '../credits-master.js';

export type IpcRequest = { id: number; type: 'req'; target: string; method: string; args: unknown[] };
export type IpcResponse = { id: number; type: 'res'; target: string; result?: unknown; error?: string };

const logger = scopedLogger('ipc');

export const getHandler = (target: string, method: string): (...args: unknown[]) => Promise<unknown> => {
	if (target === 'credits' && method === 'consume') {
		return (userId, credits) => creditsMaster!.consume(userId as string, credits as number);
	}

	if (target === 'credits' && method === 'getRemainingCredits') {
		return userId => creditsMaster!.getRemainingCredits(userId as string);
	}

	throw new Error(`Unknown method "${method}" for target "${target}".`);
};

const handleMessage = async (worker: Worker, message: IpcRequest): Promise<void> => {
	if (!message || message.type !== 'req') {
		return;
	}

	const { target, id, method, args } = message;

	try {
		const handler = getHandler(target, method);
		worker.send({ type: 'res', target, id, result: await handler(...args) });
	} catch (error) {
		logger.error(`IPC request "${target}.${method}" failed.`, error);
		worker.send({ type: 'res', target, id, error: (error as Error).message });
	}
};

export const initIPC = (): void => {
	if (!cluster.isPrimary) {
		throw new Error('`initIPC` called on non-primary process.');
	}

	cluster.on('message', (worker: Worker, message: IpcRequest) => {
		void handleMessage(worker, message);
	});
};
