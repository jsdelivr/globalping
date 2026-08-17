import { expect } from 'chai';
import * as sinon from 'sinon';
import { handleNewLogs, type LogMessage } from '../../../../src/probe/handler/logs.js';
import { timeSeriesClient } from '../../../../src/lib/sql/client.js';
import type { ServerProbe } from '../../../../src/probe/types.js';

describe('probe logs', () => {
	let sandbox: sinon.SinonSandbox;
	let transactionStub: sinon.SinonStub;
	let logHandler: ReturnType<typeof handleNewLogs>;

	const mockProbe = {
		uuid: '50d4b7ee-b37d-4c19-8e19-3155309cf90f',
		ipAddress: '1.1.1.1',
	} as ServerProbe;

	const validLog = {
		message: 'message',
		timestamp: '2026-08-15T10:00:00.000Z',
		level: 'info',
		scope: 'system',
	};

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		transactionStub = sandbox.stub(timeSeriesClient, 'transaction').resolves();
		logHandler = handleNewLogs(mockProbe);
	});

	afterEach(() => {
		sandbox.restore();
	});

	const expectValid = async (message: LogMessage) => {
		await logHandler(message);
		expect(transactionStub.calledOnce).to.equal(true);
		transactionStub.resetHistory();
	};

	const expectInvalid = async (message: unknown) => {
		const error = await logHandler(message as LogMessage).catch(err => err as Error);
		expect(error).to.be.instanceof(Error);
		expect(transactionStub.called).to.equal(false);
	};

	it('validates batch-size and field boundaries before opening a transaction', async () => {
		await expectValid({ skipped: 0, logs: Array.from({ length: 200 }, () => ({ ...validLog })) });
		await expectValid({ skipped: 0, logs: [{ ...validLog, message: 'm'.repeat(8192) }] });
		await expectValid({ skipped: 0, logs: [{ ...validLog, level: 'l'.repeat(8) }] });
		await expectValid({ skipped: 0, logs: [{ ...validLog, scope: 's'.repeat(64) }] });
		await expectValid({ skipped: 0, logs: [{ ...validLog, timestamp: '2026-08-15' }] });
		await expectValid({ skipped: 0, logs: [{ ...validLog }] });

		await expectInvalid({ skipped: 0, logs: Array.from({ length: 201 }, () => ({ ...validLog })) });
		await expectInvalid({ skipped: 0, logs: [{ ...validLog, message: 'm'.repeat(8193) }] });
		await expectInvalid({ skipped: 0, logs: [{ ...validLog, timestamp: 'not-a-date' }] });
		await expectInvalid({ skipped: 0, logs: [{ ...validLog, timestamp: '2025-02-31T00:00:00Z' }] });
		await expectInvalid({ skipped: 0, logs: [{ ...validLog, level: 'l'.repeat(9) }] });
		await expectInvalid({ skipped: 0, logs: [{ ...validLog, scope: 's'.repeat(65) }] });
	});

	it('requires a non-negative integer skipped value before opening a transaction', async () => {
		await expectValid({ skipped: 0, logs: [{ ...validLog }] });
		await expectValid({ skipped: 1, logs: [] });

		await expectInvalid({ logs: [{ ...validLog }] });
		await expectInvalid({ skipped: -1, logs: [{ ...validLog }] });
		await expectInvalid({ skipped: 1.5, logs: [{ ...validLog }] });
		await expectInvalid({ skipped: '1', logs: [{ ...validLog }] });
		await expectInvalid({ skipped: '01', logs: [{ ...validLog }] });
		await expectInvalid({ skipped: '1e2', logs: [{ ...validLog }] });
	});

	it('rejects missing fields and unknown payload fields before opening a transaction', async () => {
		await expectInvalid({ skipped: 0 });
		await expectInvalid({ skipped: 0, logs: [{ timestamp: validLog.timestamp, level: validLog.level, scope: validLog.scope }] });
		await expectInvalid({ skipped: 0, logs: [{ message: validLog.message, level: validLog.level, scope: validLog.scope }] });
		await expectInvalid({ skipped: 0, logs: [{ message: validLog.message, timestamp: validLog.timestamp, scope: validLog.scope }] });
		await expectInvalid({ skipped: 0, logs: [{ message: validLog.message, timestamp: validLog.timestamp, level: validLog.level }] });
		await expectInvalid({ skipped: 0, logs: [], extra: true });
	});

	it('returns without opening a transaction for an empty batch', async () => {
		await logHandler({ skipped: 0, logs: [] });
		expect(transactionStub.called).to.equal(false);
	});
});
