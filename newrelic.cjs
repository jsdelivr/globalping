exports.config = {
  app_name: [''],
  license_key: '',
  logging: {
    level: 'warn',
    filepath: 'stdout'
  },
  application_logging: {
    enabled: false,
    forwarding: {
      enabled: false
    }
  },
  distributed_tracing: {
    enabled: true
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
      'response.headers.x*'
    ]
  }
}
