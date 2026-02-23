import type { IoContext } from '../../lib/server.js';
import { ExtendedContext, ExtendedRouter } from '../../types.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import createHttpError from 'http-errors';
import { getProbeLogStorage } from '../logs-storage.js';
import { schema } from '../schema/get-probe-logs-schema.js';

const probeLogStorage = getProbeLogStorage();

export const registerGetProbeLogsRoute = (router: ExtendedRouter, context: IoContext): void => {
	const handle = async (ctx: ExtendedContext) => {
		const { user } = ctx.state;
		const { id } = ctx.params;

		if (!id) {
			throw createHttpError(400, `Probe ID missing.`);
		}

		const valid = schema.validate(ctx.query);

		if (valid.error) {
			throw createHttpError(400, valid.error.message, { type: 'validation_error' });
		}

		const probe = context.adoptedProbes.getById(id);

		if (!probe?.uuid || !user?.id || (!user.adminAccess && probe.userId !== user.id)) {
			throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
		}

		const logs = await probeLogStorage.readLogs(probe.uuid, ctx.query['after'] as string | undefined);
		const lastId = logs[logs.length - 1]?.id ?? null;
		ctx.body = { logs: logs.map(log => log.message), lastId };
	};

	router.get('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler(), authenticate(), handle)
		.options('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler());
};
