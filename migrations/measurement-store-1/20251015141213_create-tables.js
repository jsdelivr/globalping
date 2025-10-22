export const up = async (db) => {
	const userTiers = [
		'member',
		'sponsor',
		'special',
		'anonymous',
	];

	await db.schema.createTable('export', (table) => {
		table.text('id').notNullable();
		table.timestamp('createdAt').notNullable();
		table.json('data').notNullable();
		table.unique([ 'id', 'createdAt' ]);
	});

	await db.raw(`SELECT create_hypertable('export', by_range('createdAt', INTERVAL '1 minute'))`);

	await db.raw(`
		CREATE OR REPLACE FUNCTION export_measurement()
		RETURNS trigger AS $$
		BEGIN
			INSERT INTO export (id, "createdAt", data)
			SELECT id, "createdAt", data FROM inserted_rows;
			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql;
	`);

	for (const userTier of userTiers) {
		const tableName = `measurement_${userTier}`;

		await db.schema.createTable(tableName, (table) => {
			table.text('id').notNullable();
			table.timestamp('createdAt').notNullable();
			table.json('data').notNullable();
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
