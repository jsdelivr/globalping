import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';

type UserFields = { id?: string; accountId?: string; github_username?: string; [field: string]: unknown };
type OrgFields = { id?: string; accountId?: string; members?: { userId: string; role: string }[]; [field: string]: unknown };

export const createUser = async (sql: Knex, { id = randomUUID(), accountId = randomUUID(), ...fields }: UserFields = {}) => {
	await sql('directus_users').insert({
		id,
		adoption_token: randomUUID(),
		default_prefix: fields.github_username ?? 'default-prefix',
		...fields,
	});

	await sql('gp_accounts').insert({ id: accountId, user: id });

	return { id, accountId };
};

export const createOrg = async (sql: Knex, { id = randomUUID(), accountId = randomUUID(), members = [], ...fields }: OrgFields = {}) => {
	await sql('gp_orgs').insert({ id, name: 'test-org', ...fields });
	await sql('gp_accounts').insert({ id: accountId, org: id });

	if (members.length) {
		await sql('gp_org_members').insert(members.map(({ userId, role }) => ({ id: randomUUID(), org: id, user: userId, role })));
	}

	return { id, accountId };
};
