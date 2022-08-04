import type {DefaultContext, DefaultState, ParameterizedContext} from 'koa';
import type Router from '@koa/router';
import type {RemoteSocket} from 'socket.io';
import type {DefaultEventsMap} from 'socket.io/dist/typed-events';
import cryptoRandomString from 'crypto-random-string';
import type {SocketData} from '../../lib/ws/server.js';
import {getWsServer, PROBES_NAMESPACE} from '../../lib/ws/server.js';
import {recordOnBenchmark} from '../../lib/benchmark/index.js';

type Socket = RemoteSocket<DefaultEventsMap, SocketData>;

const io = getWsServer();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): Promise<void> => {
	const id = cryptoRandomString({length: 16, type: 'alphanumeric'});
	recordOnBenchmark({id, type: 'get_probes', action: 'start'});

	const socketList: Socket[] = await io.of(PROBES_NAMESPACE).fetchSockets();

	ctx.body = socketList.map((socket: Socket) => ({
		version: socket.data.probe.version,
		ready: socket.data.probe.ready,
		location: {
			continent: socket.data.probe.location.continent,
			region: socket.data.probe.location.region,
			country: socket.data.probe.location.country,
			state: socket.data.probe.location.state,
			city: socket.data.probe.location.city,
			asn: socket.data.probe.location.asn,
			latitute: socket.data.probe.location.latitude,
			longitude: socket.data.probe.location.longitude,
			network: socket.data.probe.location.network,
		},
		resolvers: socket.data.probe.resolvers,
	}));

	recordOnBenchmark({id, type: 'get_probes', action: 'end'});
};

export const registerGetProbesRoute = (router: Router): void => {
	router.get('/probes', handle);
};
