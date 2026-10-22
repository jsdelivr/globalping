import type { IoContext } from '../../lib/server.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import createHttpError from 'http-errors';
import { getProbeLogStorage } from '../logs-storage.js';
import { schema } from '../schema/get-probe-logs-schema.js';
import { getAuthorizedProbe } from './utils.js';

const probeLogStorage = getProbeLogStorage();

export const registerGetProbeLogsRoute = (router: ExtendedRouter, context: IoContext): void => {
	const handle = async (ctx: ExtendedContext) => {
		const valid = schema.validate(ctx.query);

		if (valid.error) {
			throw createHttpError(400, valid.error.message, { type: 'validation_error' });
		}

		const probe = getAuthorizedProbe(ctx, context.adoptedProbes);
		const { after, before, scopes, search } = valid.value;
		const { logs, lastId, firstId, hasOlder } = await probeLogStorage.readLogs(probe.uuid, { after, before, scopes, search });

		ctx.body = {
			logs: logs.map(({ timestamp, level, scope, message }) => ({ timestamp, level, scope, message })),
			lastId,
			firstId,
			hasOlder,
		};
	};

	router.get('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler(), authenticate(), handle)
		.options('/probes/:id/logs', '/probes/:id/logs', corsAuthHandler());
};
