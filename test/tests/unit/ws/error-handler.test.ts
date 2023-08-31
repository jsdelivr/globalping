import { expect } from 'chai';
import type { Socket } from 'socket.io';
import * as sinon from 'sinon';

import { WsError } from '../../../../src/lib/ws/ws-error.js';
import { errorHandler } from '../../../../src/lib/ws/helper/error-handler.js';

class MockSocket {
	public isConnected = true;

	public store: Array<{type: string; event: string; payload: any}> = [];

	public request: any = {};

	public handshake: any = {
		query: {},
	};

	constructor (public id: string) {}

	emit (event: string, payload: string | Record<string, unknown>) {
		this.store.push({ type: 'emit', event, payload });
	}

	disconnect () {
		this.isConnected = false;
	}
}

type BundledMockSocket = Socket & MockSocket;

describe('ws error', () => {
	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox({ useFakeTimers: true });
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('ws error handler', () => {
		it('should catch Error and execute cb', async () => {
			const socket = new MockSocket('abc') as BundledMockSocket;
			let cbError: Error | null = null;

			const testMethod = async (socket: Socket): Promise<void> => {
				// Prevent unused variable err
				socket.emit('connect', '');
				throw new Error('abc');
			};

			const testCb = (error: Error) => {
				cbError = error;
			};

			errorHandler(testMethod)(socket as Socket, testCb);

			expect(socket.isConnected).to.equal(true);
			await sandbox.clock.nextAsync();

			expect(socket.isConnected).to.equal(false);
			expect(cbError).to.not.be.null;
			expect(cbError).to.be.instanceof(Error);
			expect(cbError!.toString()).to.equal('Error: abc');
		});

		it('should catch WsError and execute cb', async () => {
			const socket = new MockSocket('abc') as BundledMockSocket;
			let cbError: Error | null = null;

			const testMethod = async (socket: Socket): Promise<void> => {
				// Prevent unused variable err
				socket.emit('connect', '');
				throw new WsError('vpn detected', { ipAddress: '' });
			};

			const testCb = (error: Error) => {
				cbError = error;
			};

			errorHandler(testMethod)(socket as Socket, testCb);

			expect(socket.isConnected).to.equal(true);
			await sandbox.clock.nextAsync();

			expect(socket.isConnected).to.equal(false);
			expect(cbError).to.not.be.null;
			expect(cbError).to.be.instanceof(WsError);
			expect(cbError!.toString()).to.equal('Error: vpn detected');
		});
	});
});
