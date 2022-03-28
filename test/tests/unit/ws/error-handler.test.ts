import {expect} from 'chai';
import type {Socket} from 'socket.io';

import {WsError} from '../../../../src/lib/ws/ws-error.js';
import {errorHandler} from '../../../../src/lib/ws/helper/error-handler.js';

class MockSocket {
	id: string;
	isConnected: boolean;
	store: Array<{type: string; event: string; payload: any}> = [];

	constructor(id: string) {
		this.id = id;
		this.isConnected = true;
	}

	emit(event: string, payload: string | Record<string, unknown>) {
		this.store.push({type: 'emit', event, payload});
	}

	disconnect() {
		this.isConnected = false;
	}
}

type BundledMockSocket = Socket & MockSocket;

describe('ws error', () => {
	describe('connect', () => {
		it('should catch error and disconnect socket', async () => {
			const socket = new MockSocket('abc') as BundledMockSocket;

			const testMethod = async (socket: Socket): Promise<void> => {
				// Prevent unused variable err
				socket.emit('connect', '');
				throw new Error('abc');
			};

			await errorHandler(testMethod)(socket as Socket);

			expect(socket.isConnected).to.equal(false);
		});

		it('should catch error and emit api:error event ', async () => {
			const socket = new MockSocket('abc') as BundledMockSocket;

			const testMethod = async (socket: Socket): Promise<void> => {
				// Prevent unused variable err
				socket.emit('connect', '');
				throw new WsError('abc', {socketId: socket.id});
			};

			await errorHandler(testMethod)(socket as Socket);

			const storeError = socket.store.find(m => m.event === 'api:error');
			expect(socket.isConnected).to.equal(false);
			expect(storeError).to.exist;
			expect(storeError?.payload?.message).to.equal('abc');
		});
	});
});
