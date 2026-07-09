import { expect } from 'chai';
import type { Knex } from 'knex';
import * as sinon from 'sinon';
import { Credits } from '../../../src/lib/credits.js';

describe('Credits', () => {
	const sandbox = sinon.createSandbox();
	const updateStub = sandbox.stub();
	const firstStub = sandbox.stub();
	const whereStub = sandbox.stub().returns({
		update: updateStub,
		first: firstStub,
	});
	const sqlStub = sandbox.stub().returns({
		where: whereStub,
	}) as sinon.SinonStub<any[], any> & { raw: any };
	sqlStub.raw = sandbox.stub();

	beforeEach(() => {
		sandbox.resetHistory();
	});

	it('should return true if row was updated', async () => {
		updateStub.resolves(1);
		firstStub.resolves({ amount: 5 });
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10);
		expect(result).to.deep.equal({ isConsumed: true, remainingCredits: 5 });
	});

	it('should return true if row was updated to 0', async () => {
		updateStub.resolves(1);
		firstStub.resolves({ amount: 0 });
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10);
		expect(result).to.deep.equal({ isConsumed: true, remainingCredits: 0 });
	});

	it(`should return false if row wasn't updated`, async () => {
		updateStub.resolves(0);
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10);
		expect(firstStub.callCount).to.equal(0);
		expect(result).to.deep.equal({ isConsumed: false, remainingCredits: 0 });
	});

	it(`should return false if update throws ER_CONSTRAINT_FAILED_CODE`, async () => {
		const error: Error & { errno?: number } = new Error('constraint');
		error.errno = 4025;
		updateStub.rejects(error);
		firstStub.resolves({ amount: 5 });
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10);
		expect(result).to.deep.equal({ isConsumed: false, remainingCredits: 5 });
	});

	it(`should throw if update throws other error`, async () => {
		const error = new Error('other error');
		updateStub.rejects(error);
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10).catch(err => err);
		expect(result).to.equal(error);
	});

	describe('buffering', () => {
		before(() => {
			clock.pause();
		});

		afterEach(async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 0 });
			await clock.tickAsync(62_000);
		});

		after(() => {
			clock.unpause();
		});

		it('should buffer consumes after seeding with a large balance', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);

			const first = await credits.consume('userId', 10);
			expect(first).to.deep.equal({ isConsumed: true, remainingCredits: 50000 });
			expect(updateStub.callCount).to.equal(1);

			const second = await credits.consume('userId', 10);
			expect(second).to.deep.equal({ isConsumed: true, remainingCredits: 49990 });

			const third = await credits.consume('userId', 5);
			expect(third).to.deep.equal({ isConsumed: true, remainingCredits: 49985 });

			expect(updateStub.callCount).to.equal(1);
			expect(firstStub.callCount).to.equal(1);
		});

		it('should flush accumulated deductions in a single update', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10); // Initial seed from DB, not buffered.
			await credits.consume('userId', 10);
			await credits.consume('userId', 5);

			firstStub.resolves({ amount: 49985 });
			await credits.flush();

			expect(updateStub.callCount).to.equal(2);
			expect(sqlStub.raw.args[1]).to.deep.equal([ 'GREATEST(amount - ?, 0)', [ 15 ] ]);
			expect(firstStub.callCount).to.equal(2);
			expect(await credits.getRemainingCredits('userId')).to.equal(49985);
		});

		it('should flush automatically on the interval', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10); // Initial seed from DB, not buffered.
			await credits.consume('userId', 10);

			await clock.tickAsync(1000);

			expect(updateStub.callCount).to.equal(2);
			expect(sqlStub.raw.args[1]).to.deep.equal([ 'GREATEST(amount - ?, 0)', [ 10 ] ]);
		});

		it('should fall back to the direct path when the balance drops below the threshold', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 10005 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10);
			expect(updateStub.callCount).to.equal(1);

			firstStub.resolves({ amount: 9995 });
			const second = await credits.consume('userId', 10);
			expect(second).to.deep.equal({ isConsumed: true, remainingCredits: 9995 });
			expect(updateStub.callCount).to.equal(2);

			firstStub.resolves({ amount: 9985 });
			const third = await credits.consume('userId', 10);
			expect(third).to.deep.equal({ isConsumed: true, remainingCredits: 9985 });
			expect(updateStub.callCount).to.equal(3);
		});

		it('should return fresh remaining reconciled with unflushed deductions', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10);
			expect(firstStub.callCount).to.equal(1);
			await credits.consume('userId', 10);

			expect(await credits.getRemainingCredits('userId')).to.equal(49990);
			expect(firstStub.callCount).to.equal(2);

			firstStub.resolves({ amount: 7 });
			expect(await credits.getRemainingCredits('otherUserId')).to.equal(7);
			expect(firstStub.callCount).to.equal(3);
		});

		it('should clamp the balance to zero on overdraw instead of rejecting', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10);
			await credits.consume('userId', 10);

			firstStub.resolves({ amount: 0 });
			await credits.flush();

			expect(sqlStub.raw.lastCall.args).to.deep.equal([ 'GREATEST(amount - ?, 0)', [ 10 ] ]);
			expect(await credits.getRemainingCredits('userId')).to.equal(0);

			await credits.flush();
			expect(updateStub.callCount).to.equal(2);
		});

		it('should drop the buffer item and resync when the credits row is gone', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10);
			await credits.consume('userId', 10);

			updateStub.resolves(0);
			firstStub.resolves(undefined);
			await credits.flush();

			expect(await credits.getRemainingCredits('userId')).to.equal(0);
			await credits.flush();
			expect(updateStub.callCount).to.equal(2);
		});

		it('should retry the buffer item after a generic flush error', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10);
			await credits.consume('userId', 10);

			updateStub.rejects(new Error('deadlock'));
			await credits.flush();
			expect(await credits.getRemainingCredits('userId')).to.equal(49990);

			updateStub.resolves(1);
			firstStub.resolves({ amount: 49990 });
			await credits.flush();
			expect(updateStub.callCount).to.equal(3);
			expect(sqlStub.raw.lastCall.args).to.deep.equal([ 'GREATEST(amount - ?, 0)', [ 10 ] ]);
		});

		it('should not re-queue the buffer item when only the reconcile read fails', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10);
			await credits.consume('userId', 10);

			firstStub.rejects(new Error('read failed'));
			await credits.flush();
			expect(updateStub.callCount).to.equal(2);
			expect(await credits.getRemainingCredits('userId').catch(() => 'rejected')).to.equal('rejected');

			firstStub.resolves({ amount: 49980 });
			await credits.flush();
			expect(updateStub.callCount).to.equal(2);
			expect(await credits.getRemainingCredits('userId')).to.equal(49980);
		});

		it('should keep retrying the buffer item through a DB outage longer than the TTL', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10);
			await credits.consume('userId', 10);

			updateStub.rejects(new Error('connection lost'));
			await clock.tickAsync(70_000);

			updateStub.resolves(1);
			updateStub.resetHistory();
			sqlStub.raw.resetHistory();
			await clock.tickAsync(1000);
			expect(updateStub.callCount).to.equal(1);
			expect(sqlStub.raw.args[0]).to.deep.equal([ 'GREATEST(amount - ?, 0)', [ 10 ] ]);

			await clock.tickAsync(1000);
			expect(updateStub.callCount).to.equal(1);
		});

		it('should evict idle entries', async () => {
			updateStub.resolves(1);
			firstStub.resolves({ amount: 50000 });
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.consume('userId', 10);
			expect(updateStub.callCount).to.equal(1);

			await clock.tickAsync(30_000);
			await credits.consume('userId', 10);
			expect(updateStub.callCount).to.equal(1);

			await clock.tickAsync(61_000);
			await credits.consume('userId', 10);
			expect(updateStub.callCount).to.equal(3);
		});
	});
});
