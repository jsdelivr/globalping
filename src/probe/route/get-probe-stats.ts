import createHttpError from 'http-errors';
import type { IoContext } from '../../lib/server.js';
import type { ExtendedContext, ExtendedRouter } from '../../types.js';
import { authenticate } from '../../lib/http/middleware/authenticate.js';
import { corsAuthHandler } from '../../lib/http/middleware/cors.js';
import { getProbeTestStatsStorage } from '../test-stats-storage.js';
import { schema } from '../schema/get-probe-stats-schema.js';
import { getAuthorizedProbe } from './utils.js';

const probeTestStatsStorage = getProbeTestStatsStorage();

export const registerGetProbeStatsRoute = (router: ExtendedRouter, context: IoContext): void => {
	const handle = async (ctx: ExtendedContext) => {
		const valid = schema.validate(ctx.query);

		if (valid.error) {
			throw createHttpError(400, valid.error.message, { type: 'validation_error' });
		}

		const probe = getAuthorizedProbe(ctx, context.adoptedProbes);

		ctx.body = {
			stats: await probeTestStatsStorage.readStats(probe.uuid, valid.value.period),
		};
	};

	router.get('/probes/:id/stats', '/probes/:id/stats', corsAuthHandler(), authenticate(), handle)
		.options('/probes/:id/stats', '/probes/:id/stats', corsAuthHandler());
};
