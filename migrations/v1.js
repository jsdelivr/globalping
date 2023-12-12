export const up = async (db) => {
	await db.schema.createTable('directus_users', (table) => {
		table.specificType('id', `CHAR(36)`);
		table.string('github', 255);
	});

	await db.schema.createTable('directus_notifications', (table) => {
		table.specificType('id', 'CHAR(10)');
		table.specificType('recipient', 'CHAR(36)');
		table.timestamp('timestamp').defaultTo(db.fn.now());
		table.string('subject', 255);
		table.text('message');
	});

	await db.schema.createTable('adopted_probes', (table) => {
		table.increments('id').unsigned().primary();
		table.specificType('user_created', 'CHAR(36)');
		table.timestamp('date_created').defaultTo(db.fn.now());
		table.specificType('user_updated', 'CHAR(36)');
		table.timestamp('date_updated').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
		table.string('userId', 255).notNullable();
		table.string('ip', 255).notNullable();
		table.string('uuid', 255);
		table.date('lastSyncDate').notNullable();
		table.boolean('isCustomCity').defaultTo(0);
		table.text('tags', 'longtext');
		table.string('status', 255).notNullable();
		table.string('version', 255).notNullable();
		table.string('country', 255).notNullable();
		table.string('city', 255);
		table.string('state', 255);
		table.float('latitude', 10, 5);
		table.float('longitude', 10, 5);
		table.integer('asn').notNullable();
		table.string('network', 255).notNullable();
		table.string('countryOfCustomCity', 255);
	});
};

export const down = () => {};
