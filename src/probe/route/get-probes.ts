import type { ServerProbe } from '../types.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';
import type { IoContext } from '../../lib/server.js';

export const registerGetProbesRoute = (router: ExtendedRouter, context: IoContext): void => {
	const handle = async (ctx: ExtendedContext): Promise<void> => {
		const { isAdmin } = ctx;
		let probes = await context.fetchProbes();

		if (!isAdmin) {
			probes = probes.filter(probe => probe.status === 'ready');
		}

		ctx.body = probes.map((probe: ServerProbe) => ({
			status: isAdmin ? probe.status : undefined,
			version: probe.version,
			isIPv4Supported: isAdmin ? probe.isIPv4Supported : undefined,
			isIPv6Supported: isAdmin ? probe.isIPv6Supported : undefined,
			nodeVersion: isAdmin ? probe.nodeVersion : undefined,
			uuid: isAdmin ? probe.uuid : undefined,
			ipAddress: isAdmin ? probe.ipAddress : undefined,
			altIpAddresses: isAdmin ? probe.altIpAddresses : undefined,
			location: {
				continent: probe.location.continent,
				region: probe.location.region,
				country: probe.location.country,
				state: probe.location.state,
				city: probe.location.city,
				asn: probe.location.asn,
				latitude: probe.location.latitude,
				longitude: probe.location.longitude,
				network: probe.location.network,
			},
			tags: probe.tags.map(({ value }) => value),
			isHardware: isAdmin ? probe.isHardware : undefined,
			hardwareDevice: isAdmin ? probe.hardwareDevice : undefined,
			hardwareDeviceFirmware: isAdmin ? probe.hardwareDeviceFirmware : undefined,
			resolvers: probe.resolvers,
			isProxy: isAdmin ? probe.isProxy : undefined,
			host: isAdmin ? probe.host : undefined,
			stats: isAdmin ? probe.stats : undefined,
			hostInfo: isAdmin ? probe.hostInfo : undefined,
			localAdoptionServer: isAdmin ? probe.localAdoptionServer : undefined,
		}));
	};

	router.get('/probes', '/probes', handle);
};
