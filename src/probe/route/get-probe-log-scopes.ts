import type { ExtendedContext, ExtendedRouter } from '../../types.js';
import { getProbeLogScopesStorage } from '../log-scopes-storage.js';

const probeLogScopesStorage = getProbeLogScopesStorage();

export const registerGetProbeLogScopesRoute = (router: ExtendedRouter): void => {
	const handle = async (ctx: ExtendedContext) => {
		const scopes = await probeLogScopesStorage.readScopes();

		ctx.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=3600, stale-if-error=86400');
		ctx.body = scopes;
	};

	router.get('/probes/log-scopes', '/probes/log-scopes', handle);
};
