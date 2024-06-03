module.exports = {
	server: {
		host: 'https://api.globalping.io',
		docsHost: 'https://www.jsdelivr.com',
		port: 3000,
		processes: 2,
	},
	redis: {
		url: 'redis://localhost:6379',
		socket: {
			tls: false,
		},
	},
	db: {
		type: 'mysql',
		connection: {
			host: 'localhost',
			user: 'directus',
			password: 'password',
			database: 'dashboard-globalping',
			port: 3306,
		},
	},
	admin: {
		key: '',
	},
	systemApi: {
		key: '',
	},
	geoip: {
		cache: {
			enabled: true,
			ttl: 3 * 24 * 60 * 60 * 1000, // 3 days
		},
	},
	maxmind: {
		accountId: '',
		licenseKey: '',
	},
	ipinfo: {
		apiKey: '',
	},
	ip2location: {
		apiKey: '',
	},
	ws: {
		fetchSocketsCacheTTL: 1000,
	},
	measurement: {
		anonymousRateLimit: 100000,
		authenticatedRateLimit: 250,
		rateLimitReset: 3600,
		maxInProgressProbes: 5,
		// Timeout after which measurement will be marked as finished even if not all probes respond
		timeout: 30, // 30 seconds
		// measurement result TTL in redis
		resultTTL: 7 * 24 * 60 * 60, // 7 days
		limits: {
			anonymousTestsPerLocation: 200,
			anonymousTestsPerMeasurement: 500,
			authenticatedTestsPerLocation: 500,
			authenticatedTestsPerMeasurement: 500,
		},
		globalDistribution: {
			AF: 5,
			AS: 15,
			EU: 30,
			OC: 10,
			NA: 30,
			SA: 10,
		},
	},
};
