import { expect } from 'chai';
import * as sinon from 'sinon';
import { handleNewLogs, LogMessage } from '../../../../src/probe/handler/logs.js';
import { getMeasurementRedisClient } from '../../../../src/lib/redis/measurement-client.js';
import type { ServerProbe } from '../../../../src/probe/types.js';

describe('probe logs', () => {
	let sandbox: sinon.SinonSandbox;
	let logHandler: (logMessage: LogMessage, callback?: () => void) => Promise<void>;

	let transactionStub: {
		xAdd: sinon.SinonStub;
		pExpire: sinon.SinonStub;
		exec: sinon.SinonStub;
	};

	let multiStub: sinon.SinonStub;

	const PROBE_UUID = 'mock-probe';
	const REDIS_KEY = 'probe:mock-probe:logs';

	const mockProbe = {
		uuid: PROBE_UUID,
		ipAddress: '1.1.1.1',
	} as ServerProbe;

	beforeEach(() => {
		logHandler = handleNewLogs(mockProbe);
		sandbox = sinon.createSandbox();

		transactionStub = {
			xAdd: sandbox.stub(),
			pExpire: sandbox.stub(),
			exec: sandbox.stub().resolves('OK'),
		};

		const client = getMeasurementRedisClient();
		multiStub = sandbox.stub(client, 'multi').returns(transactionStub as unknown as ReturnType<typeof client.multi>);
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('should throw on invalid inputs', async () => {
		const result1 = await logHandler({ skipped: 0 } as LogMessage).catch(err => err);
		const result2 = await logHandler({ logs: [] } as unknown as LogMessage).catch(err => err);
		const result3 = await logHandler({ skipped: 1, logs: [{ invalid: true }] } as unknown as LogMessage).catch(err => err);
		const result4 = await logHandler({ skipped: 1, logs: [], extra: true } as LogMessage).catch(err => err);

		expect(result1).to.be.instanceof(Error);
		expect(result2).to.be.instanceof(Error);
		expect(result3).to.be.instanceof(Error);
		expect(result4).to.be.instanceof(Error);

		expect(multiStub.called).to.equal(false);
		expect(transactionStub.xAdd.called).to.equal(false);
		expect(transactionStub.pExpire.called).to.equal(false);
		expect(transactionStub.exec.called).to.equal(false);
	});

	it('writes only provided logs when skipped = 0', async () => {
		const logs = [
			{ message: 'm1', timestamp: 't1', level: 'info', scope: 'system' },
			{ message: 'm2', timestamp: 't2', level: 'warn', scope: 'system' },
		];

		await logHandler({ skipped: 0, logs });

		expect(multiStub.calledOnce).to.equal(true);
		expect(transactionStub.xAdd.callCount).to.equal(2);

		for (let i = 0; i < logs.length; i++) {
			const call = transactionStub.xAdd.getCall(i);
			expect(call.args[0]).to.equal(REDIS_KEY);
			expect(call.args[1]).to.equal('*');
			expect(call.args[2]).to.deep.equal(logs[i]);
			expect(call.args[3]).to.deep.equal({ TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } });
			expect(call.args[3].TRIM.threshold).to.be.a('number');
		}

		expect(transactionStub.pExpire.calledOnceWithExactly(REDIS_KEY, 24 * 60 * 60 * 1000)).to.equal(true);
		expect(transactionStub.exec.calledOnce).to.equal(true);
	});

	it('writes a "skipped" message first when skipped > 0, then logs', async () => {
		const logs = [
			{ message: 'a', timestamp: 't1', level: 'info', scope: 'system' },
			{ message: 'b', timestamp: 't2', level: 'error', scope: 'system' },
		];

		await logHandler({ skipped: 5, logs });

		expect(multiStub.calledOnce).to.equal(true);
		expect(transactionStub.xAdd.callCount).to.equal(3);

		const first = transactionStub.xAdd.getCall(0);
		expect(first.args[0]).to.equal(REDIS_KEY);
		expect(first.args[1]).to.equal('*');
		expect(first.args[2]).to.deep.equal({ message: '...5 messages skipped...' });

		const second = transactionStub.xAdd.getCall(1);
		const third = transactionStub.xAdd.getCall(2);
		expect(second.args[2]).to.deep.equal(logs[0]);
		expect(third.args[2]).to.deep.equal(logs[1]);

		expect(transactionStub.pExpire.calledOnceWithExactly(REDIS_KEY, 24 * 60 * 60 * 1000)).to.equal(true);
		expect(transactionStub.exec.calledOnce).to.equal(true);
	});

	it('handles no skipped and no logs (just pExpire + exec after creating multi)', async () => {
		await logHandler({ skipped: 0, logs: [] });

		expect(transactionStub.xAdd.called).to.equal(false);
		expect(transactionStub.pExpire.calledOnceWithExactly(REDIS_KEY, 24 * 60 * 60 * 1000)).to.equal(true);
		expect(transactionStub.exec.calledOnce).to.equal(true);
	});
});
