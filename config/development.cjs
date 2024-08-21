module.exports = {
	server: {
		cors: {
			trustedOrigins: [
				'http://localhost:13000',
			],
		},
	},
	redis: {
		url: 'redis://localhost:16379',
		socket: {
			tls: false,
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
};
