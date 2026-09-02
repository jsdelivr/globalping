import { TTLCache } from '@isaacs/ttlcache';
import { dashboardClient } from './sql/client.js';

export const ACCOUNTS_TABLE = 'gp_accounts';
export const ORG_MEMBERS_TABLE = 'gp_org_members';
const ACCOUNT_TTL = 60 * 60 * 1000;
const MEMBERSHIP_TTL = 60 * 1000;
const SPENDING_ROLES = [ 'admin', 'member' ];

const accountIdsByUserId = new TTLCache<string, string>({ ttl: ACCOUNT_TTL });
const availabilityByUserAndAccount = new TTLCache<string, boolean>({ ttl: MEMBERSHIP_TTL });

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

// Is it a personal account of the user, or an org account where their role is 'admin' or 'member'?
export const isAccountAvailable = async (accountId: string, userId: string): Promise<boolean> => {
	const key = `${userId}:${accountId}`;
	const cached = availabilityByUserAndAccount.get(key);

	if (cached !== undefined) {
		return cached;
	}

	const account = await dashboardClient(ACCOUNTS_TABLE)
		.leftJoin(ORG_MEMBERS_TABLE, function () {
			this.on(`${ORG_MEMBERS_TABLE}.org`, `${ACCOUNTS_TABLE}.org`)
				.andOnVal(`${ORG_MEMBERS_TABLE}.user`, '=', userId)
				.andOnIn(`${ORG_MEMBERS_TABLE}.role`, SPENDING_ROLES);
		})
		.where(`${ACCOUNTS_TABLE}.id`, accountId)
		.where(function () {
			this.where(`${ACCOUNTS_TABLE}.user`, userId).orWhereNotNull(`${ORG_MEMBERS_TABLE}.id`);
		})
		.first<{ id: string } | undefined>(`${ACCOUNTS_TABLE}.id`);

	const isAvailable = Boolean(account);
	availabilityByUserAndAccount.set(key, isAvailable);

	return isAvailable;
};
