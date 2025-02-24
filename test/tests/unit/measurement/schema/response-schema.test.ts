import Joi from 'joi';
import request from 'supertest';
import { expect } from 'chai';
import { createServer } from 'node:http';
import * as sinon from 'sinon';
import { dnsResultSchema, httpResultSchema, mtrResultSchema, pingResultSchema, tracerouteResultSchema } from '../../../../../src/measurement/schema/probe-response-schema.js';
import _ from 'lodash';
import { DnsResult, HttpResult, MtrResult, PingResult, TracerouteResult } from '../../../../../src/measurement/types.js';

const defaultPingResponseBody = {
	id: '1SUVAK46JPlTRoP5',
	type: 'ping',
	status: 'finished',
	createdAt: '2025-02-21T13:57:16.971Z',
	updatedAt: '2025-02-21T13:57:27.213Z',
	target: 'globalping.io',
	probesCount: 1,
	results: [
		{
			probe: {
				continent: 'EU',
				region: 'Western Europe',
				country: 'DE',
				state: null,
				city: 'Nuremberg',
				asn: 24940,
				longitude: 11.08,
				latitude: 49.45,
				network: 'Hetzner Online GmbH',
				tags: [
					'datacenter-network',
				],
				resolvers: [
					'private',
				],
			},
			result: {
				status: 'finished',
				rawOutput: 'PING globalping.io (216.24.57.1) 56(84) bytes of data.\n64 bytes from 216.24.57.1: icmp_seq=1 ttl=56 time=14.1 ms\n\n--- globalping.io ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss, time 0ms\nrtt min/avg/max/mdev = 14.128/14.128/14.128/0.000 ms',
				resolvedAddress: '216.24.57.1',
				resolvedHostname: '216.24.57.1',
				timings: [
					{
						ttl: 56,
						rtt: 14.1,
					},
				],
				stats: {
					min: 14.128,
					max: 14.128,
					avg: 14.128,
					total: 1,
					loss: 0,
					rcv: 1,
					drop: 0,
				},
			} as PingResult,
		},
	],
};

const defaultDnsResponseBody = {
	id: 'cE5Uv6Cqt8uWgHok',
	type: 'dns',
	status: 'finished',
	createdAt: '2025-02-21T17:04:15.475Z',
	updatedAt: '2025-02-21T17:04:16.310Z',
	target: 'globalping.io',
	probesCount: 1,
	results: [
		{
			probe: {
				continent: 'SA',
				region: 'South America',
				country: 'CL',
				state: null,
				city: 'Santiago',
				asn: 31898,
				longitude: -70.57,
				latitude: -33.43,
				network: 'Oracle Corporation',
				tags: [
					'datacenter-network',
				],
				resolvers: [
					'8.8.8.8',
				],
			},
			result: {
				status: 'finished',
				statusCodeName: 'NOERROR',
				statusCode: 0,
				rawOutput: '\n; <<>> DiG 9.16.42-Debian <<>> -t A globalping.io -p 53 -4 +timeout=3 +tries=2 +nocookie +nosplit +nsid\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 52470\n;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1\n\n;; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: 512\n; NSID: 67 70 64 6e 73 2d 73 63 6c ("gpdns-scl")\n;; QUESTION SECTION:\n;globalping.io.\t\t\tIN\tA\n\n;; ANSWER SECTION:\nglobalping.io.\t\t3600\tIN\tA\t216.24.57.1\n\n;; Query time: 210 msec\n;; SERVER: 8.8.8.8#53(8.8.8.8)\n;; WHEN: Fri Feb 21 16:53:41 UTC 2025\n;; MSG SIZE  rcvd: 71\n',
				answers: [
					{
						name: 'globalping.io.',
						type: 'A',
						ttl: 3600,
						class: 'IN',
						value: '216.24.57.1',
					},
				],
				timings: {
					total: 210,
				},
				resolver: '8.8.8.8',
			} as DnsResult,
		},
	],
};

const defaultTracerouteResponseBody = {
	id: 'viv9ABdR92zaJSpG',
	type: 'traceroute',
	status: 'finished',
	createdAt: '2025-02-21T17:22:54.039Z',
	updatedAt: '2025-02-21T17:22:58.055Z',
	target: 'globalping.io',
	probesCount: 1,
	results: [
		{
			probe: {
				continent: 'SA',
				region: 'South America',
				country: 'BR',
				state: null,
				city: 'Curitiba',
				asn: 28573,
				longitude: -49.27,
				latitude: -25.43,
				network: 'Claro NXT Telecomunicacoes Ltda',
				tags: [
					'eyeball-network',
				],
				resolvers: [
					'private',
					'private',
				],
			},
			result: {
				rawOutput: 'traceroute to globalping.io (216.24.57.1), 20 hops max, 60 byte packets\n 1  NanoPi_R4S.lan (192.168.2.1)  1.467 ms  1.280 ms\n 2  100.68.224.1 (100.68.224.1)  16.352 ms  15.513 ms\n 3  bd040d09.virtua.com.br (189.4.13.9)  6.182 ms  5.211 ms\n 4  200.227.109.1 (200.227.109.1)  3.886 ms  4.045 ms\n 5  200.230.25.163 (200.230.25.163)  17.031 ms  16.596 ms\n 6  ebt-B4101-core01.spomb.embratel.net.br (200.230.243.22)  11.570 ms  11.614 ms\n 7  ebt-B112-agg04.spomb.embratel.net.br (200.230.243.86)  11.381 ms  11.464 ms\n 8  peer-B53-agg04.spomb.embratel.net.br (189.53.190.122)  11.721 ms  11.764 ms\n 9  172.68.16.35 (172.68.16.35)  14.784 ms  14.753 ms\n10  216.24.57.1 (216.24.57.1)  14.710 ms  14.628 ms',
				status: 'finished',
				resolvedAddress: '216.24.57.1',
				resolvedHostname: '216.24.57.1',
				hops: [
					{
						resolvedHostname: 'NanoPi_R4S.lan',
						resolvedAddress: '192.168.2.1',
						timings: [
							{
								rtt: 1.467,
							},
							{
								rtt: 1.28,
							},
						],
					},
					{
						resolvedHostname: '100.68.224.1',
						resolvedAddress: '100.68.224.1',
						timings: [
							{
								rtt: 16.352,
							},
							{
								rtt: 15.513,
							},
						],
					},
					{
						resolvedHostname: 'bd040d09.virtua.com.br',
						resolvedAddress: '189.4.13.9',
						timings: [
							{
								rtt: 6.182,
							},
							{
								rtt: 5.211,
							},
						],
					},
					{
						resolvedHostname: '200.227.109.1',
						resolvedAddress: '200.227.109.1',
						timings: [
							{
								rtt: 3.886,
							},
							{
								rtt: 4.045,
							},
						],
					},
					{
						resolvedHostname: '200.230.25.163',
						resolvedAddress: '200.230.25.163',
						timings: [
							{
								rtt: 17.031,
							},
							{
								rtt: 16.596,
							},
						],
					},
					{
						resolvedHostname: 'ebt-B4101-core01.spomb.embratel.net.br',
						resolvedAddress: '200.230.243.22',
						timings: [
							{
								rtt: 11.57,
							},
							{
								rtt: 11.614,
							},
						],
					},
					{
						resolvedHostname: 'ebt-B112-agg04.spomb.embratel.net.br',
						resolvedAddress: '200.230.243.86',
						timings: [
							{
								rtt: 11.381,
							},
							{
								rtt: 11.464,
							},
						],
					},
					{
						resolvedHostname: 'peer-B53-agg04.spomb.embratel.net.br',
						resolvedAddress: '189.53.190.122',
						timings: [
							{
								rtt: 11.721,
							},
							{
								rtt: 11.764,
							},
						],
					},
					{
						resolvedHostname: '172.68.16.35',
						resolvedAddress: '172.68.16.35',
						timings: [
							{
								rtt: 14.784,
							},
							{
								rtt: 14.753,
							},
						],
					},
					{
						resolvedHostname: '216.24.57.1',
						resolvedAddress: '216.24.57.1',
						timings: [
							{
								rtt: 14.71,
							},
							{
								rtt: 14.628,
							},
						],
					},
				],
			} as TracerouteResult,
		},
	],
};

const defaultMtrResponseBody = {
	id: 'eMwbkGsofdL1igAG',
	type: 'mtr',
	status: 'finished',
	createdAt: '2025-02-21T17:33:53.434Z',
	updatedAt: '2025-02-21T17:33:58.610Z',
	target: 'globalping.io',
	probesCount: 1,
	results: [
		{
			probe: {
				continent: 'AS',
				region: 'Eastern Asia',
				country: 'TW',
				state: null,
				city: 'Taipei',
				asn: 131657,
				longitude: 121.53,
				latitude: 25.05,
				network: 'Hong Da Storage Equipment Co., Ltd.',
				tags: [
					'datacenter-network',
				],
				resolvers: [
					'private',
					'private',
				],
			},
			result: {
				status: 'finished',
				rawOutput: 'Host                                                             Loss% Drop Rcv Avg  StDev  Javg \n1. AS131657 _gateway (103.153.176.254)                            0.0%    0   3 0.3    0.1   0.2\n2. AS131657 et-0-0-1.cr1.hd.tpe.as131657.net (103.51.91.5)        0.0%    0   3 0.6    0.1   0.4\n3. AS???    as13335.ly.stuix.io (103.158.187.34)                  0.0%    0   3 2.1    1.4   1.8\n4. AS397273 216.24.57.1 (216.24.57.1)                             0.0%    0   3 0.7    0.1   0.4\n',
				resolvedAddress: '216.24.57.1',
				resolvedHostname: 'undefined',
				hops: [
					{
						stats: {
							min: 0.196,
							max: 0.51,
							avg: 0.3,
							total: 3,
							loss: 0,
							rcv: 3,
							drop: 0,
							stDev: 0.1,
							jMin: 0.2,
							jMax: 0.3,
							jAvg: 0.2,
						},
						asn: [
							131657,
						],
						timings: [
							{
								rtt: 0.23,
							},
							{
								rtt: 0.51,
							},
							{
								rtt: 0.196,
							},
						],
						resolvedAddress: '103.153.176.254',
						resolvedHostname: '103-153-176-254.as131657.net',
					},
					{
						stats: {
							min: 0.494,
							max: 0.664,
							avg: 0.6,
							total: 3,
							loss: 0,
							rcv: 3,
							drop: 0,
							stDev: 0.1,
							jMin: 0.2,
							jMax: 0.6,
							jAvg: 0.4,
						},
						asn: [
							131657,
						],
						timings: [
							{
								rtt: 0.494,
							},
							{
								rtt: 0.664,
							},
							{
								rtt: 0.619,
							},
						],
						resolvedAddress: '103.51.91.5',
						resolvedHostname: 'et-0-0-1.cr1.hd.tpe.as131657.net',
					},
					{
						stats: {
							min: 0.995,
							max: 4.047,
							avg: 2.1,
							total: 3,
							loss: 0,
							rcv: 3,
							drop: 0,
							stDev: 1.4,
							jMin: 1,
							jMax: 2.7,
							jAvg: 1.8,
						},
						asn: [],
						timings: [
							{
								rtt: 1.348,
							},
							{
								rtt: 4.047,
							},
							{
								rtt: 0.995,
							},
						],
						resolvedAddress: '103.158.187.34',
						resolvedHostname: 'as13335.ly.stuix.io',
					},
					{
						stats: {
							min: 0.547,
							max: 0.783,
							avg: 0.7,
							total: 3,
							loss: 0,
							rcv: 3,
							drop: 0,
							stDev: 0.1,
							jMin: 0.1,
							jMax: 0.8,
							jAvg: 0.4,
						},
						asn: [
							397273,
						],
						timings: [
							{
								rtt: 0.547,
							},
							{
								rtt: 0.646,
							},
							{
								rtt: 0.783,
							},
						],
						resolvedAddress: '216.24.57.1',
						resolvedHostname: null,
					},
				],
			} as MtrResult,
		},
	],
};

const defaultHttpResponseBody = {
	id: 'Swese6evY799oOW6',
	type: 'http',
	status: 'finished',
	createdAt: '2025-02-21T18:10:00.037Z',
	updatedAt: '2025-02-21T18:10:01.062Z',
	target: 'globalping.io',
	probesCount: 1,
	results: [
		{
			probe: {
				continent: 'SA',
				region: 'South America',
				country: 'BR',
				state: null,
				city: 'Wenceslau Braz',
				asn: 28181,
				longitude: -49.83,
				latitude: -23.69,
				network: 'MASTER TELECOM LTDA ME',
				tags: [
					'eyeball-network',
				],
				resolvers: [
					'private',
				],
			},
			result: {
				status: 'finished',
				resolvedAddress: '216.24.57.1',
				headers: {
					'date': 'Fri, 21 Feb 2025 18:10:00 GMT',
					'content-type': 'text/html; charset=utf-8',
					'content-length': '1',
					'connection': 'close',
					'cf-ray': '9158b0d22b4a0357-CWB',
					'cf-cache-status': 'DYNAMIC',
					'cache-control': 'public, max-age=300, must-revalidate, stale-while-revalidate=600, stale-if-error=86400',
					'content-encoding': 'br',
					'etag': '"9880-p5d5+gNXtqaJk2KTNNJNDRMS3bI"',
					'link': '<https://globalping.io/>; rel="canonical"',
					'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
					'vary': 'Accept-Encoding, Accept-Encoding',
					'rndr-id': '6f430995-2331-4659',
					'x-render-origin-server': 'Render',
					'x-response-time': '12ms',
					'server': 'cloudflare',
					'alt-svc': 'h3=":443"; ma=86400',
				},
				rawHeaders: 'Date: Fri, 21 Feb 2025 18:10:00 GMT\nContent-Type: text/html; charset=utf-8\nContent-Length: 1\nConnection: close\nCF-Ray: 9158b0d22b4a0357-CWB\nCF-Cache-Status: DYNAMIC\nCache-Control: public, max-age=300, must-revalidate, stale-while-revalidate=600, stale-if-error=86400\nContent-Encoding: br\nETag: "9880-p5d5+gNXtqaJk2KTNNJNDRMS3bI"\nLink: <https://globalping.io/>; rel="canonical"\nStrict-Transport-Security: max-age=31536000; includeSubDomains; preload\nVary: Accept-Encoding, Accept-Encoding\nrndr-id: 6f430995-2331-4659\nx-render-origin-server: Render\nx-response-time: 12ms\nServer: cloudflare\nalt-svc: h3=":443"; ma=86400',
				rawBody: null,
				rawOutput: 'HTTP/1.1 200\nDate: Fri, 21 Feb 2025 18:10:00 GMT\nContent-Type: text/html; charset=utf-8\nContent-Length: 1\nConnection: close\nCF-Ray: 9158b0d22b4a0357-CWB\nCF-Cache-Status: DYNAMIC\nCache-Control: public, max-age=300, must-revalidate, stale-while-revalidate=600, stale-if-error=86400\nContent-Encoding: br\nETag: "9880-p5d5+gNXtqaJk2KTNNJNDRMS3bI"\nLink: <https://globalping.io/>; rel="canonical"\nStrict-Transport-Security: max-age=31536000; includeSubDomains; preload\nVary: Accept-Encoding, Accept-Encoding\nrndr-id: 6f430995-2331-4659\nx-render-origin-server: Render\nx-response-time: 12ms\nServer: cloudflare\nalt-svc: h3=":443"; ma=86400',
				truncated: false,
				statusCode: 200,
				statusCodeName: 'OK',
				timings: {
					total: 553,
					download: 1,
					firstByte: 273,
					dns: 221,
					tls: 41,
					tcp: 16,
				},
				tls: {
					authorized: true,
					protocol: 'TLSv1.3',
					cipherName: 'TLS_AES_256_GCM_SHA384',
					createdAt: '2025-01-27T16:52:44.000Z',
					expiresAt: '2025-04-27T17:52:41.000Z',
					issuer: {
						C: 'US',
						O: 'Google Trust Services',
						CN: 'WE1',
					},
					subject: {
						CN: 'globalping.io',
						alt: 'DNS:globalping.io',
					},
					keyType: 'EC',
					keyBits: 256,
					serialNumber: 'E5:50:05:12:BE:8A:BD:FC:0E:2B:B3:C5:AD:A7:6F:1C',
					fingerprint256: 'B5:6F:C1:11:5C:D4:8F:31:40:75:D7:ED:3C:02:76:FA:08:44:FE:FB:43:19:56:76:D5:D8:7B:4F:C2:55:6D:67',
					publicKey: '04:6D:F4:01:E4:09:92:98:DC:AA:83:25:0D:89:BC:4F:B8:F0:93:96:AA:A9:B0:DA:41:71:0D:1F:0D:66:EA:84:8F:DA:87:CA:06:4F:7A:37:79:68:79:69:66:7A:74:1B:1F:1C:36:DD:C8:6B:2E:84:C6:F2:E7:6C:26:22:21:5D:FA',
				},
			} as HttpResult,
		},
	],
};

describe('resultSchema', () => {
	const sandbox = sinon.createSandbox();

	const getResponseBody = sandbox.stub();
	const mockServer = createServer((_req, res) => {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(getResponseBody()));
	});

	beforeEach(async () => {
		sandbox.reset();
	});

	it('ping: accept regular valid response', async () => {
		const responseBody = _.cloneDeep(defaultPingResponseBody);
		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, pingResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('ping: accept unusual valid response', async () => {
		const responseBody = _.cloneDeep(defaultPingResponseBody);
		(responseBody.results[0]!.result as PingResult) = {
			status: 'finished',
			rawOutput: '',
			resolvedAddress: null,
			resolvedHostname: null,
			timings: [],
			stats: {
				min: null,
				max: null,
				avg: null,
				total: 1,
				loss: 0,
				rcv: 1,
				drop: 0,
			},
		};

		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, pingResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('ping: accept regular valid response', async () => {
		const responseBody = _.cloneDeep(defaultPingResponseBody);
		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, pingResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('ping: accept unusual valid response', async () => {
		const responseBody = _.cloneDeep(defaultPingResponseBody);
		(responseBody.results[0]!.result as PingResult) = {
			status: 'finished',
			rawOutput: '',
			resolvedAddress: null,
			resolvedHostname: null,
			timings: [],
			stats: {
				min: null,
				max: null,
				avg: null,
				total: 1,
				loss: 0,
				rcv: 1,
				drop: 0,
			},
		};

		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, pingResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('dns: accept regular valid response', async () => {
		const responseBody = _.cloneDeep(defaultDnsResponseBody);
		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, dnsResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('dns: accept unusual valid response', async () => {
		const responseBody = _.cloneDeep(defaultDnsResponseBody);
		(responseBody.results[0]!.result as DnsResult) = {
			status: 'finished',
			statusCodeName: 'NOERROR',
			statusCode: 0,
			rawOutput: '',
			answers: [],
			timings: {
				total: 210,
			},
			resolver: '8.8.8.8',
		};

		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, dnsResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('traceroute: accept regular valid response', async () => {
		const responseBody = _.cloneDeep(defaultTracerouteResponseBody);
		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, tracerouteResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('traceroute: accept unusual valid response', async () => {
		const responseBody = _.cloneDeep(defaultTracerouteResponseBody);
		(responseBody.results[0]!.result as TracerouteResult) = {
			rawOutput: '',
			status: 'finished',
			resolvedAddress: null,
			resolvedHostname: null,
			hops: [
				{
					resolvedHostname: null,
					resolvedAddress: null,
					timings: [
						{
							rtt: 1.467,
						},
					],
				},
			],
		};

		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, tracerouteResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('mtr: accept regular valid response', async () => {
		const responseBody = _.cloneDeep(defaultMtrResponseBody);
		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, mtrResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('mtr: accept unusual valid response', async () => {
		const responseBody = _.cloneDeep(defaultMtrResponseBody);
		(responseBody.results[0]!.result as MtrResult) = {
			status: 'finished',
			rawOutput: '',
			resolvedAddress: null,
			resolvedHostname: null,
			hops: [
				{
					stats: {
						min: 0.196,
						max: 0.51,
						avg: 0.3,
						total: 3,
						loss: 0,
						rcv: 3,
						drop: 0,
						stDev: 0.1,
						jMin: 0.2,
						jMax: 0.3,
						jAvg: 0.2,
					},
					asn: [
						131657,
					],
					timings: [
						{
							rtt: 0.23,
						},
						{
							rtt: 0.51,
						},
						{
							rtt: 0.196,
						},
					],
					resolvedAddress: null,
					resolvedHostname: null,
				},
			],
		};

		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, mtrResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('http: accept regular valid response', async () => {
		const responseBody = _.cloneDeep(defaultHttpResponseBody);
		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, httpResultSchema);
		expect(response).to.matchApiSchema();
	});

	it('http: accept unusual valid response', async () => {
		const responseBody = _.cloneDeep(defaultHttpResponseBody);
		(responseBody.results[0]!.result as HttpResult) = {
			status: 'finished',
			resolvedAddress: null,
			headers: {
				'Set-Cookie': [ '__Secure-ID=123; Secure; Domain=example.com', '__Host-ID=123; Secure; Path=/' ],
			},
			rawHeaders: '',
			rawBody: null,
			rawOutput: '',
			truncated: false,
			statusCode: 200,
			statusCodeName: 'OK',
			timings: {
				total: null,
				download: null,
				firstByte: null,
				dns: null,
				tls: null,
				tcp: null,
			},
			tls: {
				authorized: true,
				protocol: 'TLSv1.3',
				cipherName: 'TLS_AES_256_GCM_SHA384',
				createdAt: '2025-01-27T16:52:44.000Z',
				expiresAt: '2025-04-27T17:52:41.000Z',
				issuer: {
					C: null,
					O: null,
					CN: null,
				},
				subject: {
					CN: 'globalping.io',
					alt: 'DNS:globalping.io',
				},
				keyType: 'RSA',
				keyBits: null,
				serialNumber: 'E5:50:05:12:BE:8A:BD:FC:0E:2B:B3:C5:AD:A7:6F:1C',
				fingerprint256: 'B5:6F:C1:11:5C:D4:8F:31:40:75:D7:ED:3C:02:76:FA:08:44:FE:FB:43:19:56:76:D5:D8:7B:4F:C2:55:6D:67',
				publicKey: null,
			},
		};

		getResponseBody.returns(responseBody);

		const response = await request(mockServer).get('/v1/measurements/measurement-id');

		Joi.assert(responseBody.results[0]?.result, httpResultSchema);
		expect(response).to.matchApiSchema();
	});
});
