module.exports = {
	server: {
		session: {
			cookieSecret: 'xxx',
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
			post: {
				anonymousLimit: 100000,
			},
			getPerMeasurement: {
				limit: 1000,
			},
		},
	},
	sigtermDelay: 0,
};
