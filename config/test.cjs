module.exports = {
	server: {
		session: {
			cookieSecret: 'xxx',
		},
	},
	redis: {
		clusterMeasurements: {
			options: {
				nodeAddressMap (address) {
					if (process.env.TEST_MODE !== 'e2e') {
						return {
							host: address.substring(0, address.lastIndexOf(':')),
							port: address.substring(address.lastIndexOf(':') + 1),
						};
					}

					return {
						host: 'host.docker.internal',
						port: address.substring(address.lastIndexOf(':') + 1),
					};
				},
			},
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
