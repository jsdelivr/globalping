import type Router from '@koa/router';
import { adoptedProbes } from '../../lib/ws/server.js';
import { ExtendedContext } from '../../types.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import createHttpError from 'http-errors';
import { getProbeLogStorage } from '../log-storage.js';
import { schema } from '../schema/get-probe-logs-schema.js';

const probeLogStorage = getProbeLogStorage();

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

	const probe = adoptedProbes.getById(id);

	if (!probe?.uuid || (!user?.adminAccess && probe.userId !== user?.id)) {
		throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
	}

	const logs = await probeLogStorage.readLogs(probe.uuid, ctx.query['after'] as string | undefined);
	const lastId = logs[logs.length - 1]?.id ?? null;
	ctx.body = { logs: logs.map(log => log.message), lastId };
};

export const registerGetProbeLogsRoute = (router: Router): void => {
	router.get('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler(), authenticate(), handle)
		.options('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler());
};
