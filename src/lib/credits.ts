import { ipcWorker } from './ipc/ipc-worker.js';
import { creditsMaster, type ConsumeResult, type Credits } from './credits-master.js';

export class CreditsWorker implements Credits {
	async consume (accountId: string, credits: number): Promise<ConsumeResult> {
		return ipcWorker.request('credits', 'consume', [ accountId, credits ]) as Promise<ConsumeResult>;
	}

	async getRemainingCredits (accountId: string): Promise<number> {
		return ipcWorker.request('credits', 'getRemainingCredits', [ accountId ]) as Promise<number>;
	}
}

// In the master (and single-process runs, e.g. tests) callers use the buffer directly.
export const credits: CreditsWorker = creditsMaster ?? new CreditsWorker();
