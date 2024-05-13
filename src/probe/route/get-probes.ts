import type { DefaultContext, DefaultState, ParameterizedContext } from 'koa';
import type Router from '@koa/router';
import type { Probe } from '../types.js';
import { fetchProbes } from '../../lib/ws/server.js';

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>): Promise<void> => {
	const { isAdmin, isSystem } = ctx;
	let sockets = await fetchProbes();

	if (!isAdmin && !isSystem) {
		sockets = sockets.filter(socket => socket.status === 'ready');
	}

	ctx.body = sockets.map((socket: Probe) => ({
		status: (isAdmin || isSystem) ? socket.status : undefined,
		version: socket.version,
		isIPv4Supported: (isAdmin || isSystem) ? socket.isIPv4Supported : undefined,
		isIPv6Supported: (isAdmin || isSystem) ? socket.isIPv6Supported : undefined,
		nodeVersion: isAdmin ? socket.nodeVersion : undefined,
		uuid: isAdmin ? socket.uuid : undefined,
		ipAddress: (isAdmin || isSystem) ? socket.ipAddress : undefined,
		location: {
			continent: socket.location.continent,
			region: socket.location.region,
			country: socket.location.country,
			state: socket.location.state,
			city: socket.location.city,
			asn: socket.location.asn,
			latitude: socket.location.latitude,
			longitude: socket.location.longitude,
			network: socket.location.network,
		},
		tags: socket.tags.map(({ value }) => value),
		...(isAdmin && socket.isHardware ? { isHardware: socket.isHardware } : null),
		...(isAdmin && socket.hardwareDevice ? { hardwareDevice: socket.hardwareDevice } : null),
		resolvers: socket.resolvers,
		host: isAdmin ? socket.host : undefined,
		stats: isAdmin ? socket.stats : undefined,
	}));
};

export const registerGetProbesRoute = (router: Router): void => {
	router.get('/probes', '/probes', handle);
};
