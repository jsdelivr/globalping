module.exports = {
	server: {
		session: {
			cookieSecret: 'xxx',
		},
	},
	redis: {
		url: 'redis://localhost:16379',
		socket: {
			tls: false,
		},
	},
	db: {
		connection: {
			port: 13306,
			database: 'dashboard-globalping-test',
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
	measurement: {
		maxInProgressTests: 2,
		rateLimit: {
			get: {
				anonymousLimit: 1000,
				authenticatedLimit: 1000,
			},
		},
	},
	sigtermDelay: 0,
};
