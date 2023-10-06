import { expect } from 'chai';
import type { Knex } from 'knex';
import * as sinon from 'sinon';
import { AdoptedProbes } from '../../../src/lib/adopted-probes.js';

const selectStub = sinon.stub();
const updateStub = sinon.stub();
const deleteStub = sinon.stub();
const whereStub = sinon.stub().returns({
	update: updateStub,
	delete: deleteStub,
});
const sqlStub = sinon.stub().returns({
	select: selectStub,
	where: whereStub,
});
const fetchSocketsStub = sinon.stub().resolves([]);
let sandbox: sinon.SinonSandbox;

describe('AdoptedProbes', () => {
	beforeEach(() => {
		sandbox = sinon.createSandbox({ useFakeTimers: true });
		sinon.resetHistory();
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('startSync method should sync the data and start regular syncs', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1970-01-01' }]);

		adoptedProbes.scheduleSync();

		expect(sqlStub.callCount).to.equal(0);
		expect(selectStub.callCount).to.equal(0);
		await sandbox.clock.tickAsync(5000);
		expect(sqlStub.callCount).to.equal(1);
		expect(sqlStub.args[0]).deep.equal([ 'adopted_probes' ]);
		expect(selectStub.callCount).to.equal(1);
		expect(selectStub.args[0]).deep.equal([ 'ip', 'uuid', 'lastSyncDate' ]);
	});

	it('class should update uuid if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1970-01-01' }]);
		fetchSocketsStub.resolves([{ data: { probe: { ipAddress: '1.1.1.1', uuid: '2-2-2-2-2' } } }]);

		adoptedProbes.scheduleSync();
		await sandbox.clock.tickAsync(5000);

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ uuid: '2-2-2-2-2' }]);
	});

	it('class should update ip if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1970-01-01' }]);
		fetchSocketsStub.resolves([{ data: { probe: { ipAddress: '2.2.2.2', uuid: '1-1-1-1-1' } } }]);

		adoptedProbes.scheduleSync();
		await sandbox.clock.tickAsync(5000);

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ uuid: '1-1-1-1-1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ ip: '2.2.2.2' }]);
	});

	it('class should do nothing if adopted probe was not found and lastSyncDate < 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1969-12-15' }]);
		fetchSocketsStub.resolves([]);

		adoptedProbes.scheduleSync();
		await sandbox.clock.tickAsync(5000);

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class should do nothing if adopted probe was not found and lastSyncDate > 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1969-11-15' }]);
		fetchSocketsStub.resolves([]);

		adoptedProbes.scheduleSync();
		await sandbox.clock.tickAsync(5000);

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(1);
		expect(deleteStub.callCount).to.equal(1);
	});

	it('class should do nothing if probe data is actual', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1970-01-01' }]);
		fetchSocketsStub.resolves([{ data: { probe: { ipAddress: '1.1.1.1', uuid: '1-1-1-1-1' } } }]);

		adoptedProbes.scheduleSync();
		await sandbox.clock.tickAsync(5000);

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
	});

	it('class update lastSyncDate if probe is connected and lastSyncDate < 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1969-12-31' }]);
		fetchSocketsStub.resolves([{ data: { probe: { ipAddress: '1.1.1.1', uuid: '1-1-1-1-1' } } }]);

		adoptedProbes.scheduleSync();
		await sandbox.clock.tickAsync(5000);

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ lastSyncDate: new Date() }]);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class update lastSyncDate if probe is connected and lastSyncDate > 30 days away', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1969-11-15' }]);
		fetchSocketsStub.resolves([{ data: { probe: { ipAddress: '1.1.1.1', uuid: '1-1-1-1-1' } } }]);

		adoptedProbes.scheduleSync();
		await sandbox.clock.tickAsync(5000);

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ lastSyncDate: new Date() }]);
		expect(deleteStub.callCount).to.equal(0);
	});

	it('class update lastSyncDate should not update anything if lastSyncDate is today', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex, fetchSocketsStub);
		selectStub.resolves([{ ip: '1.1.1.1', uuid: '1-1-1-1-1', lastSyncDate: '1970-01-01' }]);
		fetchSocketsStub.resolves([{ data: { probe: { ipAddress: '1.1.1.1', uuid: '1-1-1-1-1' } } }]);

		adoptedProbes.scheduleSync();
		await sandbox.clock.tickAsync(5000);

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
		expect(deleteStub.callCount).to.equal(0);
	});
});
