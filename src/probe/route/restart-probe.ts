import createHttpError from 'http-errors';
import type { IoContext } from '../../lib/server.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import { PROBES_NAMESPACE } from '../../lib/ws/server.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';

export const registerRestartProbeRoute = (router: ExtendedRouter, context: IoContext): void => {
	const handle = (ctx: ExtendedContext) => {
		const { user } = ctx.state;
		const { id } = ctx.params;

		if (!id) {
			throw createHttpError(400, `Probe ID missing.`);
		}

		const adoptedProbe = context.adoptedProbes.getById(id);

		if (!adoptedProbe?.uuid || !user?.id || (!user.adminAccess && adoptedProbe.userId !== user.id)) {
			throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
		}

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
