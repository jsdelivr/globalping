export const up = async (db) => {
	const userTiers = [
		'member',
		'sponsor',
		'special',
		'anonymous',
	];

	await db.schema.alterTable('export', (table) => {
		table.jsonb('meta').notNullable().defaultTo(db.raw(`'{}'::jsonb`));
	});

	for (const userTier of userTiers) {
		const tableName = `measurement_${userTier}`;

		await db.schema.alterTable(tableName, (table) => {
			table.jsonb('meta').notNullable().defaultTo(db.raw(`'{}'::jsonb`));
		});
	}

	await db.raw(`
		CREATE OR REPLACE FUNCTION export_measurement()
		RETURNS trigger AS $$
		DECLARE
			tier text;
		BEGIN
			tier := replace(TG_TABLE_NAME, 'measurement_', '');

			INSERT INTO export (id, data, meta)
			SELECT id, data, jsonb_merge_patch(COALESCE(meta, '{}'::jsonb), jsonb_build_object('userTier', tier))
			FROM inserted_rows;

			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql;
	`);
};

export const down = () => {};
