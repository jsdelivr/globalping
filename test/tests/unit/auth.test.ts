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
	const leftJoinStub = sandbox.stub().returns({
		where: whereStub,
		update: updateStub,
		select: selectStub,
	});
	const sqlStub = sandbox.stub().returns({
		where: whereStub,
		leftJoin: leftJoinStub,
	}) as sinon.SinonStub<any[], any> & { raw: any };

	beforeEach(() => {
		sandbox.resetHistory();
	});

	afterEach(() => {
		selectStub.reset();
	});

	it('should sync tokens every minute', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.onCall(1).resolves([{
			value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			user_created: 'user1',
			user_github_username: 'gh_user1',
			user_user_type: 'member',
		}]);

		selectStub.onCall(2).resolves([]);

		auth.scheduleSync();
		await clock.tickAsync(60_000);

		const user1 = await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		expect(user1).to.deep.equal({
			userId: 'user1',
			username: 'gh_user1',
			userType: 'member',
			scopes: [],
			hashedToken: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
		});

		const user2 = await auth.validate('vumzijbzihrskmc2hj34yw22batpibmt', 'https://jsdelivr.com');
		expect(user2).to.equal(null);

		// should work without a username too
		selectStub.onCall(3).resolves([{
			value: '8YZ2pZoGQxfOeEGvUUkagX1yizZckq3weL+IN0chvU0=',
			user_created: 'user2',
			user_github_username: null,
			user_user_type: 'member',
		}]);

		selectStub.onCall(4).resolves([]);

		await clock.tickAsync(60_000);

		const user1afterSync = await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		expect(user1afterSync).to.equal(null);
		const user2afterSync = await auth.validate('vumzijbzihrskmc2hj34yw22batpibmt', 'https://jsdelivr.com');
		expect(user2afterSync).to.deep.equal({
			userId: 'user2',
			username: null,
			userType: 'member',
			scopes: [],
			hashedToken: '8YZ2pZoGQxfOeEGvUUkagX1yizZckq3weL+IN0chvU0=',
		});

		auth.unscheduleSync();
	});

	it('should not do sql requests for synced tokens', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.resolves([{
			value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			user_created: 'user1',
			user_github_username: 'gh_user1',
			user_user_type: 'member',
		}]);

		await auth.syncTokens();

		const user = await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');

		expect(user).to.deep.equal({
			userId: 'user1',
			username: 'gh_user1',
			userType: 'member',
			scopes: [],
			hashedToken: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
		});

		expect(selectStub.callCount).to.equal(1);
	});

	it('should cache new token', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.resolves([{
			value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			user_created: 'user1',
			user_github_username: 'gh_user1',
			user_user_type: 'member',
		}]);

		const user = await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');

		expect(user).to.deep.equal({
			userId: 'user1',
			username: 'gh_user1',
			userType: 'member',
			scopes: [],
			hashedToken: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
		});

		expect(selectStub.callCount).to.equal(1);
	});

	it('should not update date_last_used if it is actual', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.resolves([{
			value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			user_created: 'user1',
			user_github_username: 'gh_user1',
			date_last_used: new Date(),
			user_user_type: 'member',
		}]);

		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');

		expect(updateStub.callCount).to.equal(0);
	});

	it('should update date_last_used only once', async () => {
		const auth = new Auth(sqlStub as unknown as Knex);

		selectStub.resolves([{
			value: '/bSluuDrAPX9zIiZZ/hxEKARwOg+e//EdJgCFpmApbg=',
			user_created: 'user1',
			user_github_username: 'gh_user1',
			user_user_type: 'member',
		}]);

		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');
		await auth.validate('hf2fnprguymlgliirdk7qv23664c2xcr', 'https://jsdelivr.com');

		expect(updateStub.args[0]).to.deep.equal([{ date_last_used: new Date() }]);
		expect(updateStub.callCount).to.equal(1);
	});
});
