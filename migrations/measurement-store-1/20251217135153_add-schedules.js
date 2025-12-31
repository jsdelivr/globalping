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
		BEGIN
			INSERT INTO export (id, data, "scheduleId", "configurationId")
			SELECT id, data, "scheduleId", "configurationId" FROM inserted_rows;
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
