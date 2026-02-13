export const up = async (db) => {
	const defineMeasurementMetadata = (table) => {
		table.text('measurementId').notNullable();
		table.smallint('testId').notNullable();
		table.timestamp('createdAt', { precision: 0 }).notNullable();
		table.text('configurationId').notNullable();

		// Main location info.
		table.text('continent').notNullable();
		table.text('country').notNullable();
		table.text('state');
		table.text('city').notNullable();
		table.integer('asn').notNullable(); // 32 bit, we need to simulate "unsigned"

		// Additional location info.
		table.float('latitude').notNullable();
		table.float('longitude').notNullable();
		table.text('network').notNullable();
	};

	await db.schema.createTable('test_dns', (table) => {
		defineMeasurementMetadata(table);

		// Result metadata.
		table.text('resolver');

		// Metrics.
		table.boolean('up').notNullable();
		table.float('total');

		table.unique([ 'measurementId', 'testId', 'createdAt' ]);
		table.index([ 'configurationId', 'continent', 'country' ]);
	});

	await db.raw(`SELECT create_hypertable('test_dns', by_range('createdAt', INTERVAL '1 hour'))`);
	await db.raw(`ALTER TABLE test_dns SET (tsdb.enable_columnstore, tsdb.segmentby = '"configurationId", continent, country')`);

	await db.schema.createTable('test_dns_failed', (table) => {
		defineMeasurementMetadata(table);

		table.unique([ 'measurementId', 'testId', 'createdAt' ]);
		table.index([ 'configurationId', 'continent', 'country' ]);
	});

	await db.raw(`SELECT create_hypertable('test_dns_failed', by_range('createdAt', INTERVAL '1 hour'))`);
	await db.raw(`ALTER TABLE test_dns_failed SET (tsdb.enable_columnstore, tsdb.segmentby = '"configurationId", continent, country')`);

	await db.schema.createTable('test_http', (table) => {
		defineMeasurementMetadata(table);

		// Result metadata.
		table.specificType('resolvedAddress', 'cidr');

		// Metrics.
		table.boolean('up').notNullable();
		table.float('total');
		table.float('download');
		table.float('firstByte');
		table.float('dns');
		table.float('tls');
		table.float('tcp');

		table.unique([ 'measurementId', 'testId', 'createdAt' ]);
		table.index([ 'configurationId', 'continent', 'country' ]);
	});

	await db.raw(`SELECT create_hypertable('test_http', by_range('createdAt', INTERVAL '1 hour'))`);
	await db.raw(`ALTER TABLE test_http SET (tsdb.enable_columnstore, tsdb.segmentby = '"configurationId", continent, country')`);

	await db.schema.createTable('test_http_failed', (table) => {
		defineMeasurementMetadata(table);

		table.unique([ 'measurementId', 'testId', 'createdAt' ]);
		table.index([ 'configurationId', 'continent', 'country' ]);
	});

	await db.raw(`SELECT create_hypertable('test_http_failed', by_range('createdAt', INTERVAL '1 hour'))`);
	await db.raw(`ALTER TABLE test_http_failed SET (tsdb.enable_columnstore, tsdb.segmentby = '"configurationId", continent, country')`);
};

export const down = () => {};
