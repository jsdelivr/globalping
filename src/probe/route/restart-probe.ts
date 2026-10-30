import createHttpError from 'http-errors';
import type { IoContext } from '../../lib/server.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import { PROBES_NAMESPACE } from '../../lib/ws/server.js';
import { getAuthorizedProbe } from './utils.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';

export const registerRestartProbeRoute = (router: ExtendedRouter, context: IoContext): void => {
	const handle = (ctx: ExtendedContext) => {
		const { user } = ctx.state;

		if (!user?.adminAccess && user?.accountRole && ![ 'owner', 'admin' ].includes(user.accountRole)) {
			throw createHttpError(403, 'Your role in the selected organization does not allow you to restart probes.', { type: 'insufficient_permissions' });
		}

		const adoptedProbe = getAuthorizedProbe(ctx, context.adoptedProbes);

		// TODO: possibly index this later if needed in more endpoints
		const probe = context.syncedProbeList.getProbes().find(probe => probe.uuid === adoptedProbe.uuid);

		if (!probe) {
			throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
		}

		context.io.of(PROBES_NAMESPACE).to(probe.client).emit('probe:sigkill');
		ctx.status = 204;
	};

	router.post('/probes/:id/restart', '/probes/:id/restart', corsAuthHandler(), authenticate(), handle)
		.options('/probes/:id/restart', '/probes/:id/restart', corsAuthHandler());
};
