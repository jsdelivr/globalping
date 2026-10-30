import createHttpError from 'http-errors';
import type { AdoptedProbes } from '../../lib/override/adopted-probes.js';
import type { ExtendedContext } from '../../types.js';

export const getAuthorizedProbe = (ctx: ExtendedContext, adoptedProbes: AdoptedProbes) => {
	const { user } = ctx.state;
	const { id } = ctx.params;

	if (!id) {
		throw createHttpError(400, `Probe ID missing.`);
	}

	const probe = adoptedProbes.getById(id);

	if (!probe?.uuid || !user?.id || (!user.adminAccess && (!user.accountId || probe.accountId !== user.accountId))) {
		throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
	}

	return probe;
};
