import type { DefaultContext, DefaultState, ParameterizedContext } from 'koa';
import type Router from '@koa/router';
import { fetchSockets, type RemoteProbeSocket } from '../../lib/ws/server.js';

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): Promise<void> => {
	const { isAdmin } = ctx;
	let sockets = await fetchSockets();

	if (!isAdmin) {
		sockets = sockets.filter(socket => socket.data.probe.status === 'ready');
	}

	ctx.body = sockets.map((socket: RemoteProbeSocket) => ({
		status: isAdmin ? socket.data.probe.status : undefined,
		version: socket.data.probe.version,
		nodeVersion: isAdmin ? socket.data.probe.nodeVersion : undefined,
		uuid: isAdmin ? socket.data.probe.uuid : undefined,
		location: {
			continent: socket.data.probe.location.continent,
			region: socket.data.probe.location.region,
			country: socket.data.probe.location.country,
			state: socket.data.probe.location.state,
			city: socket.data.probe.location.city,
			asn: socket.data.probe.location.asn,
			latitude: socket.data.probe.location.latitude,
			longitude: socket.data.probe.location.longitude,
			network: socket.data.probe.location.network,
		},
		tags: socket.data.probe.tags.map(({ value }) => value),
		resolvers: socket.data.probe.resolvers,
		ipAddress: isAdmin ? socket.data.probe.ipAddress : undefined,
		host: isAdmin ? socket.data.probe.host : undefined,
		stats: isAdmin ? socket.data.probe.stats : undefined,
	}));
};

export const registerGetProbesRoute = (router: Router): void => {
	router.get('/probes', '/probes', handle);
};
