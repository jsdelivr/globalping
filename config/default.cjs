module.exports = {
	redis: {
		url: 'redis://localhost:6379',
	},
	maxmind: {
		accountId: '',
		licenseKey: '',
	},
	measurement: {
		// Timeout after which measurement will be marked as finished even if not all probes respond
		timeout: 30, // 30 seconds
		// measurement result TTL in redis
		resultTTL: 7 * 24 * 60, // 7 days
	},
};
