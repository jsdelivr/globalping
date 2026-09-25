import { TTLCache } from '@isaacs/ttlcache';
import { dashboardClient } from './sql/client.js';

export const ACCOUNTS_TABLE = 'gp_accounts';
export const MEMBERS_TABLE = 'gp_org_members';
const ORGS_TABLE = 'gp_orgs';
const ACCOUNT_TTL = 60 * 60 * 1000;
const ROLE_TTL = 60 * 1000;

export type AccountRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ResolvedAccount = { id: string; role: AccountRole; userType: 'member' | 'sponsor' | 'special' };

const accountIdsByUserId = new TTLCache<string, string>({ ttl: ACCOUNT_TTL });
const rolesByUserAndAccount = new TTLCache<string, ResolvedAccount | null>({ ttl: ROLE_TTL });

export const getUserAccountId = async (userId: string): Promise<string | null> => {
	const cached = accountIdsByUserId.get(userId);

	if (cached) {
		return cached;
	}

	const account = await dashboardClient(ACCOUNTS_TABLE).where({ user: userId }).first<{ id: string } | undefined>('id');

	if (account) {
		accountIdsByUserId.set(userId, account.id);
	}

	return account?.id ?? null;
};

// The role of the user in the account: 'owner' for their own, their membership role for an org, null if they are not in it.
export const getOrgRole = async (accountId: string, userId: string): Promise<ResolvedAccount | null> => {
	const key = `${userId}:${accountId}`;
	const cached = rolesByUserAndAccount.get(key);

	if (cached !== undefined) {
		return cached;
	}

	const account = await dashboardClient(ACCOUNTS_TABLE)
		.join(MEMBERS_TABLE, function () {
			this.on(`${MEMBERS_TABLE}.org`, `${ACCOUNTS_TABLE}.org`)
				.andOnVal(`${MEMBERS_TABLE}.user`, '=', userId);
		})
		.join(ORGS_TABLE, `${ORGS_TABLE}.id`, `${ACCOUNTS_TABLE}.org`)
		.where(`${ACCOUNTS_TABLE}.id`, accountId)
		.first<ResolvedAccount | undefined>(`${ACCOUNTS_TABLE}.id`, `${MEMBERS_TABLE}.role`, `${ORGS_TABLE}.user_type AS userType`);

	const role = account ? { id: account.id, role: account.role, userType: account.userType } : null;
	rolesByUserAndAccount.set(key, role);

	return role;
};
