import process from 'node:process';
import { expect } from 'chai';
import { ipcWorker as worker } from '../../../src/lib/ipc/ipc-worker.js';

const proc = process as any;

describe('IpcWorker', () => {
	let sent: any[];
	let originalSend: any;

	const emit = (message: any) => proc.emit('message', message);

	beforeEach(() => {
		sent = [];
		originalSend = proc.send;

		proc.send = (message: any) => {
			sent.push(message);
			return true;
		};
	});

	afterEach(() => {
		proc.send = originalSend;
	});

	it('should send a request tagged with the target and resolve on the reply', async () => {
		const promise = worker.request('credits', 'consume', [ 'user', 5 ]);

		expect(sent).to.have.length(1);
		expect(sent[0]).to.include({ type: 'req', target: 'credits', method: 'consume' });
		expect(sent[0].args).to.deep.equal([ 'user', 5 ]);

		emit({ type: 'res', target: 'credits', id: sent[0].id, result: { isConsumed: true, remainingCredits: 100 } });
		expect(await promise).to.deep.equal({ isConsumed: true, remainingCredits: 100 });
	});

	it('should reject on an error response', async () => {
		const promise = worker.request('credits', 'consume', [ 'user', 5 ]);
		emit({ type: 'res', target: 'credits', id: sent[0].id, error: 'boom' });

		const error = await promise.catch(e => e) as Error;
		expect(error).to.be.instanceOf(Error);
		expect(error.message).to.equal('boom');
	});

	it('should ignore unknown ids and non-responses', async () => {
		const promise = worker.request('credits', 'consume', [ 'user', 5 ]);
		const { id } = sent[0];

		emit({ type: 'res', target: 'credits', id: id + 1000, result: 'wrong' });
		emit({ type: 'req', target: 'credits', id });
		emit(undefined);
		emit({ type: 'res', target: 'credits', id, result: 'ok' });

		expect(await promise).to.equal('ok');
	});

	it('should correlate concurrent calls by id', async () => {
		const first = worker.request('credits', 'consume', [ 'a', 1 ]);
		const second = worker.request('credits', 'getRemainingCredits', [ 'b' ]);

		const [ firstId, secondId ] = sent.map(m => m.id);
		expect(secondId).to.equal(firstId + 1);

		emit({ type: 'res', target: 'credits', id: secondId, result: 42 });
		emit({ type: 'res', target: 'credits', id: firstId, result: { isConsumed: false, remainingCredits: 0 } });

		expect(await first).to.deep.equal({ isConsumed: false, remainingCredits: 0 });
		expect(await second).to.equal(42);
	});

	describe('timeout', () => {
		before(() => clock.pause());
		after(() => clock.unpause());

		it('should reject when the master does not respond', async () => {
			const settled = worker.request('credits', 'consume', [ 'user', 5 ]).catch(e => e);
			await clock.tickAsync(5000);

			const error = await settled as Error;
			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.contain('timed out');
		});
	});
});
