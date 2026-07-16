import { ipcWorker } from './ipc/ipc-worker.js';
import { creditsMaster, type ConsumeResult, type Credits } from './credits-master.js';

export class CreditsWorker implements Credits {
	async consume (userId: string, credits: number): Promise<ConsumeResult> {
		return ipcWorker.request('credits', 'consume', [ userId, credits ]) as Promise<ConsumeResult>;
	}

	async getRemainingCredits (userId: string): Promise<number> {
		return ipcWorker.request('credits', 'getRemainingCredits', [ userId ]) as Promise<number>;
	}
}

// In the master (and single-process runs, e.g. tests) callers use the buffer directly.
export const credits: CreditsWorker = creditsMaster ?? new CreditsWorker();
