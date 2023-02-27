import * as td from 'testdouble';
import {expect} from 'chai';
import * as sinon from 'sinon';
import {type MeasurementStore} from '../../../../src/measurement/store.js';

describe('measurement store', () => {
	let getMeasurementStore: () => MeasurementStore;
	let sandbox: sinon.SinonSandbox;

	const redisMock = {
		hScan: sinon.stub(),
		hDel: sinon.stub(),
		json: {
			mGet: sinon.stub(),
			set: sinon.stub(),
		},
	};
	redisMock.hScan.resolves({cursor: 0, tuples: [
		{field: 'id1', value: '1677510747483'}, // Timed out measurement
		{field: 'id2', value: '1677510747483'}, // Non-existing measurement
		{field: 'id3', value: '2677510747483'}, // Not timed out measurement
	]});
	redisMock.json.mGet.resolves([{
		id: 'id1',
		type: 'ping',
		status: 'in-progress',
		createdAt: 1_677_510_747_483,
		updatedAt: 1_677_510_747_483,
		probesCount: 1,
		results: {
			measurementId1: {
				probe: {},
				result: {
					status: 'in-progress',
					rawOutput: '',
				},
			},
		},
	}]);

	before(async () => {
		await td.replaceEsm('../../../../src/lib/redis/client.ts', {getRedisClient: () => redisMock});
		// eslint-disable-next-line unicorn/no-await-expression-member
		getMeasurementStore = (await import('../../../../src/measurement/store.js')).getMeasurementStore;
	});

	beforeEach(() => {
		sandbox = sinon.createSandbox({useFakeTimers: {now: 1_678_000_000_000}});
		sandbox.stub(Math, 'random').returns(0.8);
	});

	afterEach(() => {
		sandbox.restore();
	});

	after(() => {
		td.reset();
	});

	it('should call proper redis methods', async () => {
		getMeasurementStore();
		await sandbox.clock.tickAsync(16_000);

		expect(redisMock.hScan.callCount).to.equal(1);
		// eslint-disable-next-line @typescript-eslint/naming-convention
		expect(redisMock.hScan.firstCall.args).to.deep.equal(['gp:in-progress', 0, {COUNT: 5000}]);
		expect(redisMock.json.mGet.callCount).to.equal(1);
		expect(redisMock.json.mGet.firstCall.args).to.deep.equal([['gp:measurement:id1', 'gp:measurement:id2'], '.']);
		expect(redisMock.hDel.callCount).to.equal(1);
		expect(redisMock.hDel.firstCall.args).to.deep.equal(['gp:in-progress', ['id1', 'id2']]);
		expect(redisMock.json.set.callCount).to.equal(1);
		expect(redisMock.json.set.firstCall.args).to.deep.equal(['gp:measurement:id1', '$', {
			id: 'id1',
			type: 'ping',
			status: 'finished',
			createdAt: 1_677_510_747_483,
			updatedAt: 1_678_000_012_000,
			probesCount: 1,
			results: {
				measurementId1: {
					probe: {},
					result: {
						status: 'failed',
						rawOutput: '\n\nThe measurement timed out',
					},
				},
			},
		}]);
	});
});
