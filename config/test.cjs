module.exports = {
	redis: {
		socket: {
			tls: false,
		},
	},
	admin: {
		key: 'admin',
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
