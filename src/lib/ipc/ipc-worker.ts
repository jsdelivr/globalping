import process from 'node:process';
import type { IpcResponse } from './ipc-master.js';

const IPC_TIMEOUT = 5000;

export class IpcWorker {
	private lastId = 0;
	private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

	constructor () {
		process.on('message', (message: IpcResponse) => {
			if (!message || message.type !== 'res') {
				return;
			}

			const call = this.pending.get(message.id);

			if (!call) {
				return;
			}

			this.pending.delete(message.id);
			clearTimeout(call.timer);

			if (message.error) {
				call.reject(new Error(message.error));
			} else {
				call.resolve(message.result);
			}
		});
	}

	request (target: string, method: string, args: unknown[]): Promise<unknown> {
		const id = ++this.lastId;

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`IPC request "${target}.${method}" timed out.`));
			}, IPC_TIMEOUT);

			timer.unref();
			this.pending.set(id, { resolve, reject, timer });
			process.send?.({ type: 'req', target, id, method, args });
		});
	}
}

export const ipcWorker = new IpcWorker();
