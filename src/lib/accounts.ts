import { TTLCache } from '@isaacs/ttlcache';
import { dashboardClient } from './sql/client.js';

export const ACCOUNTS_TABLE = 'gp_accounts';
export const MEMBERS_TABLE = 'gp_org_members';
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
