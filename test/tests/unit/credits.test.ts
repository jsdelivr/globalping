import { expect } from 'chai';
import type { Knex } from 'knex';
import * as sinon from 'sinon';
import { Credits } from '../../../src/lib/credits.js';

describe('Credits', () => {
	const updateStub = sinon.stub();
	const whereStub = sinon.stub().returns({
		update: updateStub,
	});
	const sqlStub = sinon.stub().returns({
		where: whereStub,
	}) as sinon.SinonStub<any[], any> & {raw: any};
	sqlStub.raw = sinon.stub();

	beforeEach(() => {
		sinon.resetHistory();
	});

	it('should return true if row was updated', async () => {
		updateStub.resolves(1);
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10);
		expect(result).to.equal(true);
	});

	it(`should return false if row wasn't updated`, async () => {
		updateStub.resolves(0);
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10);
		expect(result).to.equal(false);
	});

	it(`should return false if update throws ER_CONSTRAINT_FAILED_CODE`, async () => {
		const error: Error & {errno?: number} = new Error('constraint');
		error.errno = 4025;
		updateStub.rejects(error);
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10);
		expect(result).to.equal(false);
	});

	it(`should throw if update throws other error`, async () => {
		const error = new Error('other error');
		updateStub.rejects(error);
		const credits = new Credits(sqlStub as unknown as Knex);
		const result = await credits.consume('userId', 10).catch(err => err);
		expect(result).to.equal(error);
	});
});
