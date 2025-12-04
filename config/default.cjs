module.exports = {
	server: {
		host: 'https://api.globalping.io',
		docsHost: 'https://globalping.io',
		port: 3000,
		processes: 2,
		cors: {
			trustedOrigins: [
				'https://globalping.io',
				'https://staging.globalping.io',
				'https://dash.globalping.io',
				'http://localhost:13000',
				'http://localhost:13010',
			],
		},
		session: {
			cookieName: 'dash_session_token',
			cookieSecret: '',
		},
		trustedProxies: [],
	},
	redis: {
		standalonePersistent: {
			url: 'redis://localhost:7001',
		},
		standalonePersistentNoEviction: {
			url: 'redis://localhost:7003',
		},
		standaloneNonPersistent: {
			url: 'redis://localhost:7002',
		},
		clusterMeasurements: {
			// listing three nodes here is enough, the rest will be discovered automatically
			nodes: {
				0: 'redis://localhost:7101',
				1: 'redis://localhost:7102',
				2: 'redis://localhost:7103',
			},
			options: {},
		},
		sharedOptions: {
			password: 'PASSWORD',
			socket: {
				tls: false,
			},
		},
	},
	dashboardDb: {
		type: 'mysql',
		connection: {
			host: 'localhost',
			user: 'directus',
			password: 'password',
			database: 'dashboard-globalping',
			port: 3306,
		},
	},
	measurementStoreDb: {
		type: 'pg',
		connection: {
			host: 'localhost',
			user: 'globalping-api',
			password: 'password',
			database: 'globalping-measurement-store-1',
			port: 5432,
		},
	},
	timeSeriesDb: {
		type: 'pg',
		connection: {
			host: 'localhost',
			user: 'globalping-api',
			password: 'password',
			database: 'globalping-time-series-1',
			port: 5432,
		},
	},
	data: {
		domainBlacklistPath: 'data/DOMAIN_BLACKLIST.json',
		ipBlacklistPath: 'data/IP_BLACKLIST.json',
	},
	dashboard: {
		directusUrl: 'https://dash-directus.globalping.io',
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
	adoptedProbes: {
		syncInterval: 60000,
	},
	adminData: {
		syncInterval: 60000,
	},
	measurement: {
		maxInProgressTests: 5,
		// Timeout after which measurement will be marked as finished even if not all probes respond
		timeout: 30, // 30 seconds
		// measurement result TTL in redis
		resultTTL: 7 * 24 * 60 * 60, // 7 days
		rateLimit: {
			post: {
				anonymousLimit: 250,
				authenticatedLimit: 500,
				reset: 3600,
			},
			getPerMeasurement: {
				limit: 5,
				reset: 2,
			},
		},
		limits: {
			anonymousTestsPerLocation: 50,
			anonymousTestsPerMeasurement: 50,
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
	reconnectProbesDelay: 2 * 60 * 1000,
	sigtermDelay: 25000,
};
