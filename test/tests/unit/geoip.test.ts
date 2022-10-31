import * as fs from 'node:fs';
import nock from 'nock';
import mockFs from 'mock-fs';
import {expect} from 'chai';
import {createStubInstance} from 'sinon';
import type {LocationInfo} from '../../../src/lib/geoip/client.js';
import {fastlyLookup} from '../../../src/lib/geoip/providers/fastly.js';
import GeoipClient from '../../../src/lib/geoip/client.js';
import NullCache from '../../../src/lib/cache/null-cache.js';
import {scopedLogger} from '../../../src/lib/logger.js';

const mocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

// eslint-disable-next-line @typescript-eslint/naming-convention
const MOCK_IP = '131.255.7.26';

describe('geoip service', () => {
	let client: GeoipClient;

	before(() => {
		client = new GeoipClient(
			new NullCache(),
			scopedLogger('geoip:test'),
		);
	});

	it('should use maxmind & digitalelement consensus', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.00'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.00'].ipinfo);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.00'].maxmind);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			normalizedRegion: 'southern america',
			region: 'Southern America',
			state: undefined,
			city: 'Buenos Aires',
			normalizedCity: 'buenos aires',
			asn: 61_493,
			latitude: -34.602,
			longitude: -58.384,
			network: 'interbs s.r.l.',
			normalizedNetwork: 'interbs s.r.l.',
		});
	});

	it('should use ipinfo as a fallback', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].ipinfo);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(400);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			asn: 61_493,
			city: 'Lagoa do Carro',
			normalizedCity: 'lagoa do carro',
			continent: 'SA',
			normalizedRegion: 'southern america',
			region: 'Southern America',
			country: 'BR',
			latitude: -7.7568,
			longitude: -35.3656,
			state: undefined,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
		});
	});

	it('should work when ipinfo is down (prioritize maxmind)', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(400);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].maxmind);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			asn: 61_493,
			city: 'Buenos Aires',
			normalizedCity: 'buenos aires',
			continent: 'SA',
			normalizedRegion: 'southern america',
			region: 'Southern America',
			country: 'AR',
			latitude: -34.602,
			longitude: -58.384,
			state: undefined,
			network: 'interbs s.r.l.',
			normalizedNetwork: 'interbs s.r.l.',
		});
	});

	it('should fail when only fastly reports', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(400);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(500);

		const info = await client.lookup(MOCK_IP).catch((error: Error) => error);

		expect(info).to.be.an.instanceof(Error);
		expect((info as Error).message).to.equal('unresolvable geoip');
	});

	it('should work when fastly is down', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(400);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].ipinfo);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].maxmind);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			asn: 61_493,
			city: 'Lagoa do Carro',
			normalizedCity: 'lagoa do carro',
			continent: 'SA',
			normalizedRegion: 'southern america',
			region: 'Southern America',
			country: 'BR',
			latitude: -7.7568,
			longitude: -35.3656,
			state: undefined,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
		});
	});

	it('should work when maxmind is down', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.01'].ipinfo);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(400);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			asn: 61_493,
			city: 'Lagoa do Carro',
			normalizedCity: 'lagoa do carro',
			continent: 'SA',
			normalizedRegion: 'southern america',
			region: 'Southern America',
			country: 'BR',
			latitude: -7.7568,
			longitude: -35.3656,
			state: undefined,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
		});
	});

	it('should detect US state', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.02'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.02'].ipinfo);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.02'].maxmind);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			asn: 43_939,
			city: 'Dallas',
			normalizedCity: 'dallas',
			continent: 'NA',
			normalizedRegion: 'northern america',
			region: 'Northern America',
			country: 'US',
			latitude: 32.7492,
			longitude: -96.8389,
			state: 'TX',
			network: 'Psychz Networks',
			normalizedNetwork: 'psychz networks',
		});
	});

	it('should filter out incomplete results', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.03'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.03'].ipinfo);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.03'].maxmind);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			asn: 61_493,
			normalizedCity: 'lagoa do carro',
			city: 'Lagoa do Carro',
			continent: 'SA',
			normalizedRegion: 'southern america',
			region: 'Southern America',
			country: 'BR',
			state: undefined,
			latitude: -7.7568,
			longitude: -35.3656,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
		});
	});

	it('should query normalized city field', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.04'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.04'].ipinfo);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.04'].maxmind);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			asn: 61_493,
			normalizedCity: 'new york',
			city: 'New York',
			normalizedRegion: 'northern america',
			region: 'Northern America',
			continent: 'NA',
			country: 'US',
			state: 'NY',
			latitude: -7.7568,
			longitude: -35.3656,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
		});
	});

	it('should pick maxmind, if ipinfo has no city', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.05'].fastly);

		nock('https://ipinfo.io')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.05'].ipinfo);

		nock('https://geoip.maxmind.com/geoip/v2.1/city/')
			.get(`/${MOCK_IP}`)
			.reply(200, mocks['00.05'].maxmind);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			normalizedRegion: 'southern america',
			region: 'Southern America',
			state: undefined,
			city: 'Buenos Aires',
			normalizedCity: 'buenos aires',
			asn: 61_493,
			latitude: -34.602,
			longitude: -58.384,
			network: 'interbs s.r.l.',
			normalizedNetwork: 'interbs s.r.l.',
		});
	});

	describe('network match', () => {
		it('should pick ipinfo data + maxmind network (missing network data)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.08'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.08'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.08'].maxmind);

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				normalizedRegion: 'northern america',
				region: 'Northern America',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				normalizedCity: 'dallas',
				asn: 40_676,
				latitude: 32.7492,
				longitude: -96.8389,
				network: 'psychz networks',
				normalizedNetwork: 'psychz networks',
			});
		});

		it('should pick ipinfo data + maxmind network (undefined network data)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.10'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.10'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.10'].maxmind);

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				normalizedRegion: 'northern america',
				region: 'Northern America',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				normalizedCity: 'dallas',
				asn: 40_676,
				latitude: 32.7492,
				longitude: -96.8389,
				network: 'psychz networks',
				normalizedNetwork: 'psychz networks',
			});
		});

		it('should fail (missing network data + city mismatch)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.09'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.09'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['00.09'].maxmind);

			const info: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(info).to.be.instanceof(Error);
		});
	});

	describe('provider parsing', () => {
		describe('fastly', () => {
			it('should filter out "reserved" city name', async () => {
				nock('https://globalping-geoip.global.ssl.fastly.net')
					.get(`/${MOCK_IP}`)
					.reply(200, mocks['00.06'].fastly);

				const result = await fastlyLookup(MOCK_IP);

				expect(result).to.deep.equal({
					client: undefined,
					location: {
						asn: 61_493,
						city: '',
						normalizedCity: '',
						continent: 'SA',
						country: 'AR',
						latitude: -34.61,
						longitude: -58.42,
						network: 'interbs s.r.l.',
						normalizedNetwork: 'interbs s.r.l.',
						state: undefined,
					},
				});
			});

			it('should filter out "private" city name', async () => {
				nock('https://globalping-geoip.global.ssl.fastly.net')
					.get(`/${MOCK_IP}`)
					.reply(200, mocks['00.07'].fastly);

				const result = await fastlyLookup(MOCK_IP);

				expect(result).to.deep.equal({
					client: undefined,
					location: {
						asn: 61_493,
						city: '',
						normalizedCity: '',
						continent: 'SA',
						country: 'AR',
						latitude: -34.61,
						longitude: -58.42,
						network: 'interbs s.r.l.',
						normalizedNetwork: 'interbs s.r.l.',
						state: undefined,
					},
				});
			});
		});
	});

	describe('limit vpn/tor connection', () => {
		it('should pass - non-vpn', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.00'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.00'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.00'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.deep.equal({
				asn: 123,
				city: 'Dallas',
				normalizedCity: 'dallas',
				normalizedRegion: 'northern america',
				region: 'Northern America',
				continent: 'NA',
				country: 'US',
				latitude: 32.7492,
				longitude: -96.8389,
				state: 'TX',
				network: 'Psychz Networks',
				normalizedNetwork: 'psychz networks',
			});
		});

		it('should pass - no client object', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.07'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.07'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.07'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.deep.equal({
				asn: 123,
				city: 'Dallas',
				normalizedCity: 'dallas',
				continent: 'NA',
				normalizedRegion: 'northern america',
				region: 'Northern America',
				country: 'US',
				latitude: 32.7492,
				longitude: -96.8389,
				state: 'TX',
				network: 'Psychz Networks',
				normalizedNetwork: 'psychz networks',
			});
		});

		it('should pass - detect VPN (whitelisted)', async () => {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			const MOCK_IP = '5.134.119.43';

			mockFs({
				config: {
					'whitelist-ips.txt': `${MOCK_IP}`,
				},
			});

			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.01'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.01'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.01'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.deep.equal({
				asn: 123,
				city: 'Dallas',
				normalizedCity: 'dallas',
				continent: 'NA',
				normalizedRegion: 'northern america',
				region: 'Northern America',
				country: 'US',
				latitude: 32.7492,
				longitude: -96.8389,
				state: 'TX',
				network: 'Psychz Networks',
				normalizedNetwork: 'psychz networks',
			});
		});

		it('should detect VPN (proxy_desc)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.01'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.01'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.01'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect TOR-EXIT (proxy_desc)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.02'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.02'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.02'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect TOR-RELAY (proxy_desc)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.03'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.03'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.03'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect corporate (proxy_type)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.03'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.03'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.03'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect aol (proxy_type)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.04'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.04'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.04'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect anonymous (proxy_type)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.05'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.05'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.05'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect blackberry (proxy_type)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.06'].fastly);

			nock('https://ipinfo.io')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.06'].ipinfo);

			nock('https://geoip.maxmind.com/geoip/v2.1/city/')
				.get(`/${MOCK_IP}`)
				.reply(200, mocks['01.06'].maxmind);

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});
	});
});
