export const up = async (db) => {
	const userTiers = [
		'member',
		'sponsor',
		'special',
		'anonymous',
	];

	await db.schema.createTable('export', (table) => {
		table.text('id').notNullable();
		table.timestamp('exportedAt', { precision: 0 }).notNullable().defaultTo(db.fn.now());
		table.binary('data').notNullable();
		table.unique([ 'id', 'exportedAt' ]);
	});

	await db.raw(`SELECT create_hypertable('export', by_range('exportedAt', INTERVAL '1 minute'))`);

	await db.raw(`
		CREATE OR REPLACE FUNCTION export_measurement()
		RETURNS trigger AS $$
		BEGIN
			INSERT INTO export (id, data)
			SELECT id, data FROM inserted_rows;
			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql;
	`);

	for (const userTier of userTiers) {
		const tableName = `measurement_${userTier}`;

		await db.schema.createTable(tableName, (table) => {
			table.text('id').notNullable();
			table.timestamp('createdAt', { precision: 0 }).notNullable();
			table.binary('data').notNullable();
			table.unique([ 'id', 'createdAt' ]);
		});

		await db.raw(`SELECT create_hypertable('${tableName}', by_range('createdAt', INTERVAL '7 days'))`);
		await db.raw(`SELECT add_retention_policy('${tableName}', INTERVAL '180 days')`);

		await db.raw(`
			CREATE TRIGGER ${tableName}_export
			AFTER INSERT ON ${tableName}
			REFERENCING NEW TABLE AS inserted_rows
			FOR EACH STATEMENT
			EXECUTE FUNCTION export_measurement();
		`);
	}
};

export const down = () => {};
