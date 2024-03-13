import { expect } from 'chai';
import type { Knex } from 'knex';
import * as sinon from 'sinon';
import { Auth } from '../../../src/lib/http/auth.js';

describe('Auth', () => {
	const sandbox = sinon.createSandbox();
	const updateStub = sandbox.stub();
	const selectStub = sandbox.stub().resolves([]);
	const whereStub = sandbox.stub().returns({
		update: updateStub,
		select: selectStub,
	});
	const sqlStub = sandbox.stub().returns({
		where: whereStub,
	}) as sinon.SinonStub<any[], any> & {raw: any};

	beforeEach(() => {
		sandbox.resetHistory();
	});

	afterEach(() => {
		selectStub.reset();
	});

	it('should sync tokens every minute', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.onCall(1).resolves([{
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			user_created: 'user1',
		}]);

		selectStub.onCall(2).resolves([]);

		auth.scheduleSync();
		await clock.tickAsync(60_000);

		const user1 = await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		expect(user1).to.equal('user1');
		const user2 = await auth.validate('ve7w6UTaOt3aXpctEk8wJQtkJwz2IOMY', 'https://jsdelivr.com');
		expect(user2).to.equal(null);

		selectStub.onCall(3).resolves([{
			value: 'r8S12cmTjYeMIb/KcYE2a/LLQGBdHdhC0VxTyt2eeAQ=',
			user_created: 'user2',
		}]);

		selectStub.onCall(4).resolves([]);

		await clock.tickAsync(60_000);

		const user1afterSync = await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		expect(user1afterSync).to.equal(null);
		const user2afterSync = await auth.validate('ve7w6UTaOt3aXpctEk8wJQtkJwz2IOMY', 'https://jsdelivr.com');
		expect(user2afterSync).to.equal('user2');
		auth.unscheduleSync();
	});

	it('should not do sql requests for synced tokens', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.resolves([{
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			user_created: 'user1',
		}]);

		await auth.syncTokens();

		const user = await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');

		expect(user).to.equal('user1');
		expect(selectStub.callCount).to.equal(1);
	});

	it('should cache new token', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.resolves([{
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			user_created: 'user1',
		}]);

		const user = await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');

		expect(user).to.equal('user1');
		expect(selectStub.callCount).to.equal(1);
	});

	it('should not update date_last_used if it is actual', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.resolves([{
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			user_created: 'user1',
			date_last_used: new Date(),
		}]);

		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');

		expect(updateStub.callCount).to.equal(0);
	});

	it('should update date_last_used only once', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.resolves([{
			value: 'aGmWPCV1JN/qmYl27g8VpBjhCmTpbFcbdrWgTvEtqo4=',
			user_created: 'user1',
		}]);

		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');
		await auth.validate('VRbBNLbHkckWRcPmWv0Kj3xwBpi32Ij4', 'https://jsdelivr.com');

		expect(updateStub.args[0]).to.deep.equal([{ date_last_used: new Date() }]);
		expect(updateStub.callCount).to.equal(1);
	});
});
