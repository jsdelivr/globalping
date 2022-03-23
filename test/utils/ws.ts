import {Socket} from 'socket.io';
import {createStubInstance} from 'sinon';
import type {DeepPartial} from '../types.js';
import type {Probe} from '../../src/probe/types.js';
import {getWsServer, PROBES_NAMESPACE} from '../../src/lib/ws/server.js';

export const addFakeProbe = async (id: string, probe: DeepPartial<Probe>): Promise<void> => {
	const nsp = getWsServer().of(PROBES_NAMESPACE);
	const mockedProbe = createStubInstance(Socket);
	mockedProbe.data = {probe};

	nsp.sockets.set(id, mockedProbe);
	await nsp.adapter.addAll(id, new Set([id]));
};

export const deleteFakeProbe = (id: string): void => {
	const nsp = getWsServer().of(PROBES_NAMESPACE);
	nsp.sockets.delete(id);
	nsp.adapter.delAll(id);
};
