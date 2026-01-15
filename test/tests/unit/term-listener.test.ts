import { expect } from 'chai';
import * as sinon from 'sinon';
import * as td from 'testdouble';

describe('term-listener', () => {
	describe('MasterTermListener', () => {
		let MasterTermListener: any;
		const sandbox = sinon.createSandbox();

		const processStub = {
			pid: 12345,
			on: sandbox.stub(),
			exit: sandbox.stub(),
			env: {},
		};

		const worker1 = { send: sandbox.stub() };
		const worker2 = { send: sandbox.stub() };

		const clusterStub = {
			workers: { 1: worker1, 2: worker2 },
		};

		const configStub = {
			get: sandbox.stub(),
		};

		before(async () => {
			await td.replaceEsm('node:process', { default: processStub });
			await td.replaceEsm('node:cluster', { default: clusterStub });
			await td.replaceEsm('config', { default: configStub });

			const module = await import('../../../src/lib/term-listener.js');
			MasterTermListener = module.MasterTermListener;
		});

		beforeEach(() => {
			sandbox.reset();
			configStub.get.withArgs('sigtermDelay').returns(5000);
		});

		after(() => {
			sandbox.restore();
			td.reset();
		});

		it('should attach signal listeners on SIGTERM and SIGINT', () => {
			new MasterTermListener();

			expect(processStub.on.calledWith('SIGTERM', sinon.match.func)).to.be.true;
			expect(processStub.on.calledWith('SIGINT', sinon.match.func)).to.be.true;
		});

		it('should send terminating message to all workers when receiving signal', () => {
			new MasterTermListener();

			const sigtermCall = processStub.on.getCalls().find((call: any) => call.args[0] === 'SIGTERM');
			const sigtermHandler = sigtermCall?.args[1];

			sigtermHandler('SIGTERM');

			expect(worker1.send.calledWith({ type: 'terminating', signal: 'SIGTERM', delay: 5000 })).to.be.true;
			expect(worker2.send.calledWith({ type: 'terminating', signal: 'SIGTERM', delay: 5000 })).to.be.true;
		});

		it('should exit process after delay', async () => {
			new MasterTermListener();

			const sigtermCall = processStub.on.getCalls().find((call: any) => call.args[0] === 'SIGTERM');
			const sigtermHandler = sigtermCall?.args[1];

			sigtermHandler('SIGTERM');

			await clock.tickAsync(4999);
			expect(processStub.exit.called).to.be.false;

			await clock.tickAsync(1);
			expect(processStub.exit.calledWith(0)).to.be.true;
		});

		it('should not attach listeners if sigtermDelay is 0', () => {
			configStub.get.withArgs('sigtermDelay').returns(0);

			new MasterTermListener();

			expect(processStub.on.called).to.be.false;
		});

		it('should call listener only once for multiple signals', () => {
			configStub.get.withArgs('sigtermDelay').returns(5000);

			new MasterTermListener();

			const sigtermCall = processStub.on.getCalls().find((call: any) => call.args[0] === 'SIGTERM');
			const sigtermHandler = sigtermCall?.args[1];

			sigtermHandler('SIGTERM');
			sigtermHandler('SIGTERM');
			sigtermHandler('SIGTERM');

			expect(worker1.send.callCount).to.equal(1);
			expect(worker2.send.callCount).to.equal(1);
		});

		it('should continue sending to other workers if one throws an error', () => {
			worker1.send.throws(new Error('IPC channel closed'));

			new MasterTermListener();

			const sigtermCall = processStub.on.getCalls().find((call: any) => call.args[0] === 'SIGTERM');
			const sigtermHandler = sigtermCall?.args[1];

			expect(() => sigtermHandler('SIGTERM')).to.not.throw();
			expect(worker2.send.calledWith({ type: 'terminating', signal: 'SIGTERM', delay: 5000 })).to.be.true;
		});
	});

	describe('WorkerTermListener', () => {
		let WorkerTermListener: any;
		let messageHandler: any;
		const sandbox = sinon.createSandbox();

		const processStub = {
			pid: 67890,
			on: sandbox.stub(),
			env: {},
		};

		before(async () => {
			processStub.on.withArgs('message', sinon.match.func).callsFake((_event: string, handler: any) => {
				messageHandler = handler;
			});

			await td.replaceEsm('node:process', { default: processStub });
			await td.replaceEsm('node:cluster', null, { isWorker: true });

			const module = await import('../../../src/lib/term-listener.js');
			WorkerTermListener = module.WorkerTermListener;
		});

		beforeEach(() => {
			sandbox.reset();

			processStub.on.withArgs('message', sinon.match.func).callsFake((_event: string, handler: any) => {
				messageHandler = handler;
			});
		});

		after(() => {
			sandbox.restore();
			td.reset();
		});

		it('should attach message listener', () => {
			new WorkerTermListener();

			expect(processStub.on.calledWith('message', sinon.match.func)).to.be.true;
		});

		it('should set isTerminating to true when receiving terminating message', () => {
			const listener = new WorkerTermListener();

			expect(listener.getIsTerminating()).to.equal(false);

			messageHandler({ type: 'terminating', signal: 'SIGTERM', delay: 5000 });

			expect(listener.getIsTerminating()).to.equal(true);
		});

		it('should emit terminating event with signal and delay', (done) => {
			const listener = new WorkerTermListener();

			listener.on('terminating', ({ signal, delay }: { signal: string; delay: number }) => {
				expect(signal).to.equal('SIGTERM');
				expect(delay).to.equal(5000);
				done();
			});

			messageHandler({ type: 'terminating', signal: 'SIGTERM', delay: 5000 });
		});

		it('should ignore non-terminating messages', () => {
			const listener = new WorkerTermListener();
			let eventEmitted = false;

			listener.on('terminating', () => {
				eventEmitted = true;
			});

			messageHandler({ type: 'other', data: 'test' });
			messageHandler('string message');
			messageHandler(null);
			messageHandler(undefined);

			expect(listener.getIsTerminating()).to.equal(false);
			expect(eventEmitted).to.equal(false);
		});

		it('should handle multiple terminating messages', () => {
			const listener = new WorkerTermListener();
			const events: Array<{ signal: string; delay: number }> = [];

			listener.on('terminating', (data: { signal: string; delay: number }) => {
				events.push(data);
			});

			messageHandler({ type: 'terminating', signal: 'SIGTERM', delay: 5000 });
			messageHandler({ type: 'terminating', signal: 'SIGINT', delay: 3000 });

			expect(events).to.have.lengthOf(2);
			expect(events[0]).to.deep.equal({ signal: 'SIGTERM', delay: 5000 });
			expect(events[1]).to.deep.equal({ signal: 'SIGINT', delay: 3000 });
		});
	});
});
