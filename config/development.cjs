module.exports = {
	server: {
		session: {
			cookieSecret: 'xxx',
		},
	},
	dashboardDb: {
		connection: {
			port: 13306,
		},
	},
	measurementStoreDb: {
		connection: {
			port: 15432,
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
	sigtermDelay: 0,
};
