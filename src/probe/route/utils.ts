import createHttpError from 'http-errors';
import { getUserRoleInAccount } from '../../lib/accounts.js';
import type { AdoptedProbes } from '../../lib/override/adopted-probes.js';
import type { AuthenticateStateUser } from '../../lib/http/middleware/authenticate.js';
import type { ExtendedContext } from '../../types.js';

const getRoleInProbeAccount = async (user: AuthenticateStateUser, accountId: string) => {
	if (accountId === user.accountId) {
		return user.accountRole;
	}

	// A session user may act on probes of their other accounts. A token stays bound to its own account.
	return user.authMode === 'cookie' ? getUserRoleInAccount(user.id!, accountId) : null;
};

export const getAuthorizedProbe = async (ctx: ExtendedContext, adoptedProbes: AdoptedProbes, readOnly = false) => {
	const { user } = ctx.state;
	const { id } = ctx.params;

	if (!id) {
		throw createHttpError(400, `Probe ID missing.`);
	}

	const probe = adoptedProbes.getById(id);

	if (!probe?.uuid || !user?.id) {
		throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
	}

	if (user.adminAccess) {
		return probe;
	}

	const role = probe.accountId ? await getRoleInProbeAccount(user, probe.accountId) : null;

	if (!role) {
		throw createHttpError(404, `Probe not found.`, { type: 'not_found' });
	}

	if (!readOnly && ![ 'owner', 'admin' ].includes(role)) {
		throw createHttpError(403, 'Your role in the organization does not allow you to manage probes.', { type: 'insufficient_permissions' });
	}

	return probe;
};
