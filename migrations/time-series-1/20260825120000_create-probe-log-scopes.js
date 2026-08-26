export const up = async (db) => {
	await db.schema.createTable('probe_log_scope', (table) => {
		table.uuid('probeUuid').notNullable();
		table.string('scope', 64).notNullable();
		table.timestamp('lastSeenAt', { useTz: true }).notNullable();
		table.primary([ 'probeUuid', 'scope' ]);
		table.index([ 'scope' ]);
		table.index([ 'lastSeenAt' ]);
	});

	await db.raw(`
		CREATE OR REPLACE PROCEDURE cleanup_probe_log_scopes(job_id int, config jsonb)
		LANGUAGE PLPGSQL
		AS $$
		BEGIN
			DELETE FROM probe_log_scope
			WHERE "lastSeenAt" < now() - interval '30 days';
		END;
		$$
	`);

	await db.raw(`
		SELECT add_job('cleanup_probe_log_scopes', interval '1 day')
		WHERE NOT EXISTS (
			SELECT 1
			FROM timescaledb_information.jobs
			WHERE proc_schema = 'public' AND proc_name = 'cleanup_probe_log_scopes'
		)
	`);
};

export const down = () => {};
