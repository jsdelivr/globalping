import { TTLCache } from '@isaacs/ttlcache';
import { dashboardClient } from './sql/client.js';

export const ACCOUNTS_TABLE = 'gp_accounts';
export const MEMBERS_TABLE = 'gp_org_members';
const ACCOUNT_TTL = 60 * 60 * 1000;
const ROLE_TTL = 60 * 1000;

export type AccountRole = 'owner' | 'admin' | 'member' | 'viewer';

const accountIdsByUserId = new TTLCache<string, string>({ ttl: ACCOUNT_TTL });
const rolesByUserAndAccount = new TTLCache<string, AccountRole | null>({ ttl: ROLE_TTL });

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
export const getAccountRole = async (accountId: string, userId: string): Promise<AccountRole | null> => {
	const key = `${userId}:${accountId}`;
	const cached = rolesByUserAndAccount.get(key);

	if (cached !== undefined) {
		return cached;
	}

	const account = await dashboardClient(ACCOUNTS_TABLE)
		.leftJoin(MEMBERS_TABLE, function () {
			this.on(`${MEMBERS_TABLE}.org`, `${ACCOUNTS_TABLE}.org`)
				.andOnVal(`${MEMBERS_TABLE}.user`, '=', userId);
		})
		.where(`${ACCOUNTS_TABLE}.id`, accountId)
		.where(function () {
			this.where(`${ACCOUNTS_TABLE}.user`, userId).orWhereNotNull(`${MEMBERS_TABLE}.id`);
		})
		.first<{ role: AccountRole } | undefined>(dashboardClient.raw(
			`IF(?? = ?, 'owner', ??) AS role`,
			[ `${ACCOUNTS_TABLE}.user`, userId, `${MEMBERS_TABLE}.role` ],
		));

	const role = account?.role ?? null;
	rolesByUserAndAccount.set(key, role);

	return role;
};
