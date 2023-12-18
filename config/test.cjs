module.exports = {
	redis: {
		socket: {
			tls: false,
		},
	},
	db: {
		connection: {
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
