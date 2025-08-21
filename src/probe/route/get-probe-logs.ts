import type Router from '@koa/router';
import { adoptedProbes } from '../../lib/ws/server.js';
import { ExtendedContext } from '../../types.js';
import { getMeasurementRedisClient } from '../../lib/redis/measurement-client.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { getRedisProbeLogKey } from '../handler/logs.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';

const handle = async (ctx: ExtendedContext) => {
	const { user } = ctx.state;
	const { id } = ctx.params;
	const { since } = ctx.query;

	if (!id) {
		return ctx.throw(400, 'Probe ID missing');
	}

	const probe = adoptedProbes.getById(id);

	if (!probe || (!user?.admin_access && probe.userId !== user?.id)) {
		ctx.throw(404, 'Probe not found');
	}

	const redis = getMeasurementRedisClient();
	const redisKey = getRedisProbeLogKey(id);

	const start = since && typeof since !== 'object' ? `${since}-0` : '-';

	const logs = await redis.xRange(redisKey, start, '+');

	ctx.body = logs.map(log => log.message);
};

export const registerProbeLogsRoute = (router: Router): void => {
	router.get('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler(), authenticate(), handle)
		.options('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler());
};
