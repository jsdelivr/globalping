export const up = async (db) => {
	await db.schema.createTable('probe_log_counter', (table) => {
		table.uuid('probeUuid').primary();
		table.bigInteger('lastAllocatedId').notNullable();
	});

	await db.schema.createTable('probe_log', (table) => {
		table.uuid('probeUuid').notNullable();
		table.bigInteger('probeLogId').notNullable();
		table.timestamp('timestamp', { useTz: true });
		table.timestamp('receivedAt', { useTz: true }).notNullable();
		table.string('level', 8);
		table.string('scope', 64);
		table.string('message', 8192).notNullable();
	});

	await db.raw(`SELECT create_hypertable('probe_log', by_range('receivedAt', INTERVAL '1 day'))`);
	await db.raw(`SELECT add_retention_policy('probe_log', INTERVAL '3 days')`);
	await db.raw(`CREATE INDEX probe_log_probe_cursor_idx ON probe_log ("probeUuid", "probeLogId" DESC)`);
	await db.raw(`CREATE INDEX probe_log_probe_scope_cursor_idx ON probe_log ("probeUuid", "scope", "probeLogId" DESC)`);
};

export const down = () => {};
