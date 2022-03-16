import type {DefaultContext, DefaultState, ParameterizedContext} from 'koa';
import type Router from '@koa/router';
import type {RemoteSocket} from 'socket.io';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import type {SocketData} from '../../lib/ws/server.js';
import {getWsServer, PROBES_NAMESPACE} from '../../lib/ws/server.js';

type Socket = RemoteSocket<DefaultEventsMap, SocketData>;

const io = getWsServer();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>) => {
	const socketList: Socket[] = await io.of(PROBES_NAMESPACE).fetchSockets();

	ctx.body = socketList.map((socket: Socket) => socket.data.probe.location);
};

export const registerGetProbesRoute = (router: Router) => {
	router.get('/probes', handle);
};
