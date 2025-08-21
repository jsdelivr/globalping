import type Router from '@koa/router';
import { adoptedProbes } from '../../lib/ws/server.js';
import { ExtendedContext } from '../../types.js';
import { getMeasurementRedisClient } from '../../lib/redis/measurement-client.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { getRedisProbeLogKey } from '../handler/logs.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import createHttpError from 'http-errors';

const handle = async (ctx: ExtendedContext) => {
	const { user } = ctx.state;
	const { id } = ctx.params;
	const { since } = ctx.query;

	if (!id) {
		throw createHttpError(400, `Probe ID missing.`);
	}

	const probe = adoptedProbes.getById(id);

	if (!probe || (!user?.admin_access && probe.userId !== user?.id)) {
		throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
	}

	const redis = getMeasurementRedisClient();
	const redisKey = getRedisProbeLogKey(id);
	let start = '-';

	if (since) {
		const parsedSince = Array.isArray(since) ? undefined : Number(since);

		if (parsedSince === undefined || !Number.isFinite(parsedSince) || parsedSince < 0) {
			throw createHttpError(400, 'Invalid "since" parameter', { type: 'validation_error' });
		}

		start = `${Math.floor(parsedSince)}-0`;
	}

	const logs = await redis.xRange(redisKey, start, '+');

	ctx.body = logs.map(log => log.message);
};

export const registerProbeLogsRoute = (router: Router): void => {
	router.get('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler(), authenticate(), handle)
		.options('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler());
};
