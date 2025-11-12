export async function up (knex) {
	await knex.schema.createTable('export_job', (table) => {
		table.text('target').notNullable();
		table.text('chunkName').notNullable();
		table.timestamp('chunkStart', { useTz: true }).notNullable();
		table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
		table.text('status').notNullable().checkIn([ 'pending', 'succeeded', 'failed' ]);
		table.integer('attempt').notNullable().defaultTo(0);
		table.primary([ 'target', 'chunkName', 'chunkStart' ]);
	});

	await knex.raw(`SELECT create_hypertable('export_job', by_range('chunkStart', INTERVAL '7 days'))`);
	await knex.raw(`SELECT add_retention_policy('export_job', INTERVAL '180 days')`);
}

export const down = () => {};
