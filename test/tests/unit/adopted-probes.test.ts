import { expect } from 'chai';
import { Knex } from 'knex';
import * as sinon from 'sinon';
import { AdoptedProbes } from '../../../src/lib/adopted-probes.js';

const selectStub = sinon.stub();
const updateStub = sinon.stub();
const whereStub = sinon.stub().returns({
	update: updateStub,
});
const sqlStub = sinon.stub().returns({
	select: selectStub,
	where: whereStub,
});
let clock: sinon.SinonSandbox['clock'];

describe('AdoptedProbes', () => {
	before(() => {
		clock = sinon.useFakeTimers();
	});

	beforeEach(() => {
		sinon.resetHistory();
	});

	afterEach(() => {
		clock.restore();
	});

	it('startSync method should sync the data and start regular syncs', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex);
		selectStub.resolves([{
			ip: '1.1.1.1',
			uuid: '1-1-1-1-1',
		}]);

		await adoptedProbes.startSync();

		expect(sqlStub.callCount).to.equal(1);
		expect(sqlStub.args[0]).deep.equal([ 'adopted_probes' ]);
		expect(selectStub.callCount).to.equal(1);
		expect(selectStub.args[0]).deep.equal([ 'ip', 'uuid' ]);

		await clock.tickAsync(5500);
		expect(sqlStub.callCount).to.equal(2);
		expect(selectStub.callCount).to.equal(2);
	});

	it('syncProbeIds method should do nothing if probe was not found either by ip or uuid', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex);
		selectStub.resolves([{
			ip: '1.1.1.1',
			uuid: '1-1-1-1-1',
		}]);

		await adoptedProbes.startSync();
		await adoptedProbes.syncProbeIds('2.2.2.2', '2-2-2-2-2');

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
	});

	it('syncProbeIds method should do nothing if probe data is actual', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex);
		selectStub.resolves([{
			ip: '1.1.1.1',
			uuid: '1-1-1-1-1',
		}]);

		await adoptedProbes.startSync();
		await adoptedProbes.syncProbeIds('1.1.1.1', '1-1-1-1-1');

		expect(whereStub.callCount).to.equal(0);
		expect(updateStub.callCount).to.equal(0);
	});

	it('syncProbeIds method should update uuid if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex);
		selectStub.resolves([{
			ip: '1.1.1.1',
			uuid: '1-1-1-1-1',
		}]);

		await adoptedProbes.startSync();
		await adoptedProbes.syncProbeIds('1.1.1.1', '2-2-2-2-2');

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ ip: '1.1.1.1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ uuid: '2-2-2-2-2' }]);
	});

	it('syncProbeIds method should update ip if it is wrong', async () => {
		const adoptedProbes = new AdoptedProbes(sqlStub as unknown as Knex);
		selectStub.resolves([{
			ip: '1.1.1.1',
			uuid: '1-1-1-1-1',
		}]);

		await adoptedProbes.startSync();
		await adoptedProbes.syncProbeIds('2.2.2.2', '1-1-1-1-1');

		expect(whereStub.callCount).to.equal(1);
		expect(whereStub.args[0]).to.deep.equal([{ uuid: '1-1-1-1-1' }]);
		expect(updateStub.callCount).to.equal(1);
		expect(updateStub.args[0]).to.deep.equal([{ ip: '2.2.2.2' }]);
	});
});
