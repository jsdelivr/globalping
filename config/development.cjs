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
	admin: {
		key: 'admin',
	},
	systemApi: {
		key: 'system',
	},
	reconnectProbesDelay: 0,
};
