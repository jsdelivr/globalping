import type Router from '@koa/router';
import { adoptedProbes } from '../../lib/ws/server.js';
import { ExtendedContext } from '../../types.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import createHttpError from 'http-errors';
import { probeLogStorage } from '../log-storage.js';
import { validate } from '../../lib/http/middleware/validate.js';
import { schema } from '../schema/get-probe-logs-schema.js';

const handle = async (ctx: ExtendedContext) => {
	const { user } = ctx.state;
	const { uuid } = ctx.params;
	const { since } = ctx.query;

	if (!uuid) {
		throw createHttpError(400, `Probe UUID missing.`);
	}

	const probe = adoptedProbes.getByUuid(uuid);

	if (!probe || (!user?.adminAccess && probe.userId !== user?.id)) {
		throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
	}

	const logs = await probeLogStorage.readLogs(uuid, since ? Number(since as string) : undefined);
	ctx.body = logs.map(log => log.message);
};

export const registerProbeLogsRoute = (router: Router): void => {
	router.get('/probes/:uuid/logs', '/probes/:uuid/logs', corsAuthHandler(), authenticate(), validate({ query: schema }), handle)
		.options('/probes/:uuid/logs', '/probes/:uuid/logs', corsAuthHandler());
};
