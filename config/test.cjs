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
			enabled: false,
		},
	},
	ws: {
		fetchSocketsCacheTTL: 1, // 1 ms ttl here to disable fetchSockets cache in tests
	},
	measurement: {
		maxInProgressProbes: 2,
	},
};
