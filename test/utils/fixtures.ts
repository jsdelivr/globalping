import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';

type UserFields = { id?: string; github_username?: string; [field: string]: unknown };
type OrgFields = { id?: string; members?: { userId: string; role: string }[]; [field: string]: unknown };

const getAccountId = async (sql: Knex, owner: { user: string } | { org: string }) => {
	const account = await sql('gp_accounts').where(owner).first<{ id: string } | undefined>('id');

	if (!account) {
		throw new Error(`No account created for ${JSON.stringify(owner)}.`);
	}

	return account.id;
};

export const createUser = async (sql: Knex, { id = randomUUID(), ...fields }: UserFields = {}) => {
	await sql('directus_users').insert({
		id,
		adoption_token: randomUUID(),
		default_prefix: fields.github_username ?? 'default-prefix',
		...fields,
	});

	return { id, accountId: await getAccountId(sql, { user: id }) };
};

export const createOrg = async (sql: Knex, { id = randomUUID(), members = [], ...fields }: OrgFields = {}) => {
	await sql('gp_orgs').insert({ id, name: 'test-org', adoption_token: randomUUID(), ...fields });

	if (members.length) {
		await sql('gp_org_members').insert(members.map(({ userId, role }) => ({ id: randomUUID(), org: id, user: userId, role })));
	}

	return { id, accountId: await getAccountId(sql, { org: id }) };
};
