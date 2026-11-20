import { ACCOUNTS_TABLE, MEMBERS_TABLE, type AccountRole } from './http/auth.js';
import { dashboardClient } from './sql/client.js';

export const getUserRoleInAccount = async (userId: string, accountId: string): Promise<AccountRole | null> => {
	const row = await dashboardClient(ACCOUNTS_TABLE)
		.leftJoin(MEMBERS_TABLE, function () {
			this.on(`${MEMBERS_TABLE}.org`, `${ACCOUNTS_TABLE}.org`).andOnVal(`${MEMBERS_TABLE}.user`, '=', userId);
		})
		.where(`${ACCOUNTS_TABLE}.id`, accountId)
		.first<{ role: AccountRole | null } | undefined>(dashboardClient.raw(`IF(${ACCOUNTS_TABLE}.user = ?, 'owner', ${MEMBERS_TABLE}.role) AS role`, [ userId ]));

	return row?.role ?? null;
};
