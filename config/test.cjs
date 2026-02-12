module.exports = {
	server: {
		session: {
			cookieSecret: 'xxx',
		},
	},
	websocketServer: {
		pingInterval: 2 ** 20,
		pingTimeout: 2 ** 20,
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
	dashboardDb: {
		connection: {
			port: 13306,
			database: 'dashboard-globalping-test',
			multipleStatements: true,
		},
	},
	measurementStoreDb: {
		connection: {
			port: 15432,
			database: 'globalping-measurement-store-1-test',
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
			getPerMeasurement: {
				limit: 1000,
			},
		},
	},
	reconnectProbesDelay: 0,
	sigtermDelay: 0,
};
