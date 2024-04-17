/* eslint-disable camelcase */

exports.config = {
	app_name: [ '' ],
	license_key: '',
	logging: {
		level: 'info',
		filepath: 'stdout',
	},
	application_logging: {
		enabled: true,
		forwarding: {
			enabled: true,
		},
	},
	distributed_tracing: {
		enabled: true,
	},
	error_collector: {
		ignore_status_codes: [ 400, 401, 403, 404, 405, 422, 429 ],
		ignore_classes: [ 'UnprocessableEntityError', 'BadRequestError' ],
		ignore_messages: [ 'No suitable probes found', 'Too Many Probes Requested' ],
	},
	span_events: {
		max_samples_stored: 100,
	},
	transaction_events: {
		max_samples_stored: 100,
		attributes: {
			enabled: false,
		},
	},
	rules: {
		ignore: [
			'^/socket.io/.*/xhr-polling/', // default item
			'^/health',
		],
	},
	allow_all_headers: true,
	attributes: {
		exclude: [
			'request.headers.cookie',
			'request.headers.authorization',
			'request.headers.proxyAuthorization',
			'request.headers.setCookie*',
			'request.headers.x*',
			'response.headers.cookie',
			'response.headers.authorization',
			'response.headers.proxyAuthorization',
			'response.headers.setCookie*',
			'response.headers.x*',
		],
	},
};
