import { TTLCache } from '@isaacs/ttlcache';
import { dashboardClient } from './sql/client.js';

export const ACCOUNTS_TABLE = 'gp_accounts';
export const MEMBERS_TABLE = 'gp_org_members';
export const ORGS_TABLE = 'gp_orgs';
const ACCOUNT_TTL = 60 * 60 * 1000;

export type AccountRole = 'owner' | 'admin' | 'member' | 'viewer';

const accountIdsByUserId = new TTLCache<string, string>({ ttl: ACCOUNT_TTL });

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

export const getUserRoleInAccount = async (userId: string, accountId: string): Promise<AccountRole | null> => {
	const row = await dashboardClient(ACCOUNTS_TABLE)
		.leftJoin(MEMBERS_TABLE, function () {
			this.on(`${MEMBERS_TABLE}.org`, `${ACCOUNTS_TABLE}.org`).andOnVal(`${MEMBERS_TABLE}.user`, '=', userId);
		})
		.where(`${ACCOUNTS_TABLE}.id`, accountId)
		.first<{ role: AccountRole | null } | undefined>(dashboardClient.raw(`IF(${ACCOUNTS_TABLE}.user = ?, 'owner', ${MEMBERS_TABLE}.role) AS role`, [ userId ]));

	return row?.role ?? null;
};
