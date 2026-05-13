import { expect } from 'chai';
import got from 'got';
import type { Knex } from 'knex';
import * as sinon from 'sinon';
import { Credits } from '../../../src/lib/credits.js';

describe('Credits', () => {
	const sandbox = sinon.createSandbox();
	const updateStub = sandbox.stub();
	const firstStub = sandbox.stub();
	const usersSelectStub = sandbox.stub();
	const settingsFirstStub = sandbox.stub();
	const whereStub = sandbox.stub().returns({
		update: updateStub,
		first: firstStub,
	});
	const sqlStub = sandbox.stub() as sinon.SinonStub<any[], any> & { raw: any };
	sqlStub.callsFake((table: string) => {
		if (table === 'directus_users') { return { whereNotNull: () => ({ select: usersSelectStub }) }; }

		if (table === 'directus_settings') { return { first: settingsFirstStub }; }

		return { where: whereStub };
	});

	sqlStub.raw = sandbox.stub();

	let gotPostStub: sinon.SinonStub;

	beforeEach(() => {
		sandbox.resetHistory();
		gotPostStub = sandbox.stub(got, 'post');
		gotPostStub.resolves({} as any);
	});

	afterEach(() => {
		gotPostStub.restore();
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

	describe('syncPreferences', () => {
		beforeEach(() => {
			settingsFirstStub.resolves({ low_credits_default_threshold: 25000 });

			usersSelectStub.resolves([
				{ id: 'u-empty', notification_preferences: '{}' },
				{ id: 'u-disabled', notification_preferences: '{"low_credits":{"enabled":false}}' },
				{ id: 'u-explicit', notification_preferences: '{"low_credits":{"enabled":true,"parameter":500}}' },
				{ id: 'u-no-param', notification_preferences: '{"low_credits":{"enabled":true}}' },
			]);
		});

		it('reads default threshold from directus_settings and populates the cache', async () => {
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.syncPreferences();

			expect((credits as any).defaultThreshold).to.equal(25000);
			expect((credits as any).userIdToPreference.get('u-empty')).to.equal(undefined);
			expect((credits as any).userIdToPreference.get('u-disabled')).to.equal(false);
			expect((credits as any).userIdToPreference.get('u-explicit')).to.equal(500);
			expect((credits as any).userIdToPreference.get('u-no-param')).to.equal(undefined);
		});

		it('keeps previous defaultThreshold when SQL fetch fails', async () => {
			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.syncPreferences();
			settingsFirstStub.rejects(new Error('boom'));
			await credits.syncPreferences().catch(() => {});
			expect((credits as any).defaultThreshold).to.equal(25000);
		});
	});

	describe('low_credits notification', () => {
		const buildCredits = async (entry?: false | number) => {
			settingsFirstStub.resolves({ low_credits_default_threshold: 10000 });

			if (entry === false) {
				usersSelectStub.resolves([{ id: 'userId', notification_preferences: '{"low_credits":{"enabled":false}}' }]);
			} else if (typeof entry === 'number') {
				usersSelectStub.resolves([{ id: 'userId', notification_preferences: `{"low_credits":{"enabled":true,"parameter":${entry}}}` }]);
			} else {
				usersSelectStub.resolves([]);
			}

			const credits = new Credits(sqlStub as unknown as Knex);
			await credits.syncPreferences();
			return credits;
		};

		beforeEach(() => {
			updateStub.resolves(1);
		});

		it('fires a notification when remaining drops below default threshold', async () => {
			firstStub.resolves({ amount: 9000 });
			const credits = await buildCredits();
			await credits.consume('userId', 2000);
			expect(gotPostStub.callCount).to.equal(1);
			expect((gotPostStub.firstCall.args[1] as any).json).to.deep.include({ recipient: 'userId', type: 'low_credits' });
		});

		it('does not fire when staying below threshold', async () => {
			firstStub.resolves({ amount: 500 });
			const credits = await buildCredits();
			await credits.consume('userId', 100);
			expect(gotPostStub.callCount).to.equal(0);
		});

		it('does not fire when staying above threshold', async () => {
			firstStub.resolves({ amount: 50000 });
			const credits = await buildCredits();
			await credits.consume('userId', 100);
			expect(gotPostStub.callCount).to.equal(0);
		});

		it('does not fire for users with cache entry false', async () => {
			firstStub.resolves({ amount: 9000 });
			const credits = await buildCredits(false);
			await credits.consume('userId', 2000);
			expect(gotPostStub.callCount).to.equal(0);
		});

		it('uses explicit per-user threshold from cache', async () => {
			firstStub.resolves({ amount: 400 });
			const credits = await buildCredits(500);
			await credits.consume('userId', 200);
			expect(gotPostStub.callCount).to.equal(1);
		});

		it('does not block consume on notification POST failure', async () => {
			firstStub.resolves({ amount: 9000 });
			gotPostStub.rejects(new Error('directus down'));
			const credits = await buildCredits();
			const result = await credits.consume('userId', 2000);
			expect(result).to.deep.equal({ isConsumed: true, remainingCredits: 9000 });
		});

		it('does not fire when consume failed (isConsumed: false)', async () => {
			updateStub.resolves(0);
			const credits = await buildCredits();
			await credits.consume('userId', 2000);
			expect(gotPostStub.callCount).to.equal(0);
		});
	});
});
