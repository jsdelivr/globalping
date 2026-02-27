export const up = async (db) => {
	const userTiers = [
		'member',
		'sponsor',
		'special',
		'anonymous',
	];

	await db.schema.alterTable('export', (table) => {
		table.text('scheduleId');
		table.text('configurationId');
	});

	await db.raw(`
		CREATE OR REPLACE FUNCTION export_measurement()
		RETURNS trigger AS $$
		DECLARE
			tier text;
		BEGIN
			tier := replace(TG_TABLE_NAME, 'measurement_', '');

			INSERT INTO export (id, data, meta, "scheduleId", "configurationId")
			SELECT id, data, COALESCE(meta, '{}'::jsonb) || jsonb_build_object('userTier', tier), "scheduleId", "configurationId"
			FROM inserted_rows;

			RETURN NULL;
		END;
		$$ LANGUAGE plpgsql;
	`);

	for (const userTier of userTiers) {
		const tableName = `measurement_${userTier}`;

		await db.schema.alterTable(tableName, (table) => {
			table.text('scheduleId');
			table.text('configurationId');
		});
	}
};

export const down = () => {};
