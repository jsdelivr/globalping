export const up = async (db) => {
	const counters = [ 'assigned', 'finished', 'failedTarget', 'failedResolver', 'failedInternal', 'timedOut' ];

	await db.schema.createTable('probe_test_stats_hourly', (table) => {
		table.uuid('probeUuid').notNullable();
		table.timestamp('hour', { useTz: true }).notNullable();
		table.text('testType').notNullable();

		for (const counter of counters) {
			table.integer(counter).notNullable();
			table.check(`"${counter}" >= 0`);
		}

		table.check(`"testType" IN ('ping', 'traceroute', 'dns', 'http', 'mtr')`);
		table.unique([ 'probeUuid', 'hour', 'testType' ]);
	});

	await db.raw(`SELECT create_hypertable('probe_test_stats_hourly', by_range('hour', INTERVAL '1 day'))`);
	await db.raw(`ALTER TABLE probe_test_stats_hourly SET (tsdb.enable_columnstore, tsdb.segmentby = '"probeUuid"')`);
	await db.raw(`CALL add_columnstore_policy('probe_test_stats_hourly', after => INTERVAL '7 days')`);
	await db.raw(`SELECT add_retention_policy('probe_test_stats_hourly', INTERVAL '14 months')`);
};

export const down = () => {};
