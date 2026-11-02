import createHttpError from 'http-errors';
import type { AdoptedProbes } from '../../lib/override/adopted-probes.js';
import type { ExtendedContext } from '../../types.js';

export const getAuthorizedProbe = (ctx: ExtendedContext, adoptedProbes: AdoptedProbes, readOnly = false) => {
	const { user } = ctx.state;
	const { id } = ctx.params;

	if (!id) {
		throw createHttpError(400, `Probe ID missing.`);
	}

	if (!readOnly && !user?.adminAccess && user?.accountRole && ![ 'owner', 'admin' ].includes(user.accountRole)) {
		throw createHttpError(403, 'Your role in the selected organization does not allow you to manage probes.', { type: 'insufficient_permissions' });
	}

	const probe = adoptedProbes.getById(id);

	if (!probe?.uuid || !user?.id || (!user.adminAccess && (!user.accountId || probe.accountId !== user.accountId))) {
		throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
	}

	return probe;
};
