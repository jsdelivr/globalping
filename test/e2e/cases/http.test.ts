import got from 'got';
import { expect } from 'chai';
import { waitMeasurementFinish } from '../utils.js';

describe('http measurement', () => {
	it('should finish successfully', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'http',
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody).to.equal(null);
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of GET request', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'http',
				measurementOptions: {
					request: {
						method: 'GET',
					},
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody.length).to.be.above(0);
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of OPTIONS request', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'http',
				measurementOptions: {
					request: {
						method: 'OPTIONS',
					},
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody).to.equal(null);
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of IPv6 domain target', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'http',
				measurementOptions: {
					ipVersion: 6,
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody).to.equal(null);
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully in case of IPv6 address target', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: '2606:4700:3037::ac43:d071',
				type: 'http',
				measurementOptions: {
					request: {
						host: 'www.jsdelivr.com',
					},
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody).to.equal(null);
		expect(response).to.matchApiSchema();
	});

	it('should have null tls and dns timings for HTTP request to IP', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: '2606:4700:3037::ac43:d071',
				type: 'http',
				measurementOptions: {
					protocol: 'HTTP',
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.timings.tls).to.equal(null);
		expect(response.body.results[0].result.timings.dns).to.equal(null);
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully with HTTP2 protocol', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'http',
				measurementOptions: {
					protocol: 'HTTP2',
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawOutput.startsWith('HTTP/2.0 200')).to.be.true;
		Object.values(response.body.results[0].result.timings).forEach((v: any) => expect(v).to.be.a('number'));
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully with 404 response', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'http',
				measurementOptions: {
					request: { method: 'GET', path: '/nonexistent-path-12345' },
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.statusCode).to.equal(404);
		expect(response.body.results[0].result.statusCodeName).to.equal('Not Found');
		expect(response).to.matchApiSchema();
	});

	it('should finish successfully with custom headers', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'postman-echo.com',
				type: 'http',
				measurementOptions: {
					protocol: 'HTTP',
					request: {
						method: 'GET',
						path: '/headers',
						headers: { 'X-Custom-Header': 'test-value' },
					},
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody).to.include('"x-custom-header":"test-value"');
		expect(response).to.matchApiSchema();
	});

	it('should handle big response', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'cdn.jsdelivr.net',
				type: 'http',
				measurementOptions: {
					protocol: 'HTTPS',
					request: { method: 'GET', path: '/npm/jquery' },
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.rawBody.length).to.equal(10000);
		expect(response).to.matchApiSchema();
	});

	it('should return tls error for expired certificate', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'expired.badssl.com',
				type: 'http',
				measurementOptions: {
					protocol: 'HTTPS',
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('finished');
		expect(response.body.results[0].result.tls.error).to.equal('CERT_HAS_EXPIRED');
		expect(response).to.matchApiSchema();
	});

	it('should return 400 for blacklisted target', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'google-ads.xyz',
				type: 'http',
			},
			throwHttpErrors: false,
		});

		expect(response.statusCode).to.equal(400);
	});

	it('should return 400 for blacklisted request host', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'http',
				measurementOptions: {
					request: {
						host: 'google-ads.xyz',
					},
				},
			},
			throwHttpErrors: false,
		});

		expect(response.statusCode).to.equal(400);
	});

	it('should return 400 for blacklisted resolver', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'www.jsdelivr.com',
				type: 'http',
				measurementOptions: {
					resolver: '101.109.234.248',
				},
			},
			throwHttpErrors: false,
		});

		expect(response.statusCode).to.equal(400);
	});

	it('should fail for nonexistent domain', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'nonexistent.invalid',
				type: 'http',
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('failed');
		expect(response.body.results[0].result.rawOutput).to.include('ENOTFOUND');
		expect(response).to.matchApiSchema();
	});

	it('should fail HTTP2 request to HTTP/1.1 only server', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', {
			json: {
				target: 'httpforever.com',
				type: 'http',
				measurementOptions: {
					protocol: 'HTTP2',
				},
			},
		}).json<any>();

		const response = await waitMeasurementFinish(id);

		expect(response.body.status).to.equal('finished');
		expect(response.body.results[0].result.status).to.equal('failed');
		expect(response).to.matchApiSchema();
	});
});
