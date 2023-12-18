module.exports = {
	redis: {
		socket: {
			tls: false,
		},
	},
	db: {
		connection: {
			database: 'directus-test',
			multipleStatements: true,
		},
	},
	admin: {
		key: 'admin',
	},
	systemApi: {
		key: 'system',
	},
	geoip: {
		cache: {
			ttl: 1, // 1 ms ttl here to disable redis cache in tests
		},
	},
	ws: {
		fetchSocketsCacheTTL: 1, // 1 ms ttl here to disable fetchSockets cache in tests
	},
	measurement: {
		maxInProgressProbes: 2,
	},
};
