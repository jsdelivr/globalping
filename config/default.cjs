module.exports = {
	host: 'https://api.globalping.io',
	redis: {
		url: 'redis://localhost:6379',
		socket: {
			tls: true,
			rejectUnauthorized: false,
		},
	},
	admin: {
		key: '',
	},
	geoip: {
		cache: {
			ttl: 3 * 24 * 60 * 60 * 1000, // 24hrs
		},
	},
	appsignal: {
		active: false,
		pushApiKey: '',
	},
	maxmind: {
		accountId: '',
		licenseKey: '',
	},
	ipinfo: {
		apiKey: '',
	},
	measurement: {
		// Timeout after which measurement will be marked as finished even if not all probes respond
		timeout: 30, // 30 seconds
		// measurement result TTL in redis
		resultTTL: 7 * 24 * 60 * 60, // 7 days
		limits: {
			global: 500,
			location: 200,
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
