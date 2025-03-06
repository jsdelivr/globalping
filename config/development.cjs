module.exports = {
	server: {
		session: {
			cookieSecret: 'xxx',
		},
	},
	db: {
		connection: {
			port: 13306,
		},
	},
	dashboard: {
		directusUrl: 'http://localhost:18055',
	},
	admin: {
		key: 'admin',
	},
	systemApi: {
		key: 'system',
	},
	adoptedProbes: {
		syncInterval: 5000,
	},
	adminData: {
		syncInterval: 5000,
	},
	reconnectProbesDelay: 0,
};
