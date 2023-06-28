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
		fetchSocketsCacheTTL: 0,
	},
	measurement: {
		maxInProgressProbes: 2,
	},
};
