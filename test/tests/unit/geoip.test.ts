import nock from 'nock';
import mockFs from 'mock-fs';
import { expect } from 'chai';
import type { LocationInfo } from '../../../src/lib/geoip/client.js';
import { fastlyLookup } from '../../../src/lib/geoip/providers/fastly.js';
import GeoipClient from '../../../src/lib/geoip/client.js';
import NullCache from '../../../src/lib/cache/null-cache.js';
import { populateMemList } from '../../../src/lib/geoip/whitelist.js';
import nockGeoIpProviders, { geoIpMocks } from '../../utils/nock-geo-ip.js';
import { CacheInterface } from '../../../src/lib/cache/cache-interface.js';

const MOCK_IP = '131.255.7.26';

describe('geoip service', () => {
	let client: GeoipClient;

	before(async () => {
		await populateMemList();

		client = new GeoipClient(new NullCache());
	});

	afterEach(() => {
		nock.cleanAll();
	});


	describe('GeoipClient', () => {
		it('should work even if cache is failing', async () => {
			class BrokenCache implements CacheInterface {
				async delete (): Promise<undefined> {
					throw new Error('delete is broken');
				}

				async get (): Promise<undefined> {
					throw new Error('get is broken');
				}

				async set (): Promise<void> {
					throw new Error('set is broken');
				}
			}

			const clientWithBrokenCache = new GeoipClient(new BrokenCache());
			nockGeoIpProviders();

			const info = await clientWithBrokenCache.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedRegion: 'northern america',
				normalizedCity: 'dallas',
				asn: 20001,
				latitude: 32.001,
				longitude: -96.001,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
			});
		});
	});

	it('should choose top prioritized provider from the winners majority', async () => {
		nockGeoIpProviders({ ipmap: 'default', ip2location: 'default', maxmind: 'argentina', fastly: 'argentina', ipinfo: 'argentina' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: undefined,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedRegion: 'south america',
			normalizedCity: 'buenos aires',
			asn: 61003,
			latitude: -34.003,
			longitude: -58.003,
			network: 'interbs s.r.l.',
			normalizedNetwork: 'interbs s.r.l.',
		});
	});

	it('should choose top prioritized provider if some providers are down', async () => {
		nock('https://ipmap-api.ripe.net/v1/locate/').get(/.*/).reply(400);
		nock('https://api.ip2location.io').get(/.*/).reply(400);
		nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, geoIpMocks['fastly'].argentina);
		nock('https://ipinfo.io').get(/.*/).reply(200, geoIpMocks['ipinfo'].argentina);
		nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(400);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'BR',
			state: undefined,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedRegion: 'south america',
			normalizedCity: 'buenos aires',
			asn: 61004,
			latitude: -34.004,
			longitude: -58.004,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
		});
	});

	it('should fulfill ipmap network data with other provider network data with the same city', async () => {
		nockGeoIpProviders({ ipmap: 'default', ip2location: 'argentina', maxmind: 'newYork', ipinfo: 'emptyCity', fastly: 'default' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			region: 'Northern America',
			normalizedRegion: 'northern america',
			normalizedCity: 'dallas',
			asn: 20005,
			latitude: 32.002,
			longitude: -96.002,
			network: 'psychz networks',
			normalizedNetwork: 'psychz networks',
		});
	});

	it('should fulfill missing data with other provider network data with the same city', async () => {
		nockGeoIpProviders({ ip2location: 'emptyNetwork', ipmap: 'default', maxmind: 'emptyCity', ipinfo: 'emptyCity', fastly: 'default' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			region: 'Northern America',
			normalizedRegion: 'northern america',
			normalizedCity: 'dallas',
			asn: 20005,
			latitude: 32.001,
			longitude: -96.001,
			network: 'psychz networks',
			normalizedNetwork: 'psychz networks',
		});
	});

	it('should choose top prioritized provider when there is a draw in returned results', async () => {
		nockGeoIpProviders({ ipmap: 'argentina', ip2location: 'emptyCity', maxmind: 'newYork', ipinfo: 'argentina', fastly: 'newYork' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: undefined,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedRegion: 'south america',
			normalizedCity: 'buenos aires',
			asn: 61004,
			latitude: -34.002,
			longitude: -58.002,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
		});
	});

	it('should choose top prioritized provider when all providers returned different cities', async () => {
		nockGeoIpProviders({ ipmap: 'default', ip2location: 'argentina', maxmind: 'newYork', ipinfo: 'emptyCity', fastly: 'bangkok' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: undefined,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedRegion: 'south america',
			normalizedCity: 'buenos aires',
			asn: 61001,
			latitude: -34.001,
			longitude: -58.001,
			network: 'interbs s.r.l.',
			normalizedNetwork: 'interbs s.r.l.',
		});
	});

	it('should fail when only fastly reports the data', async () => {
		nock('https://ipmap-api.ripe.net/v1/locate/').get(/.*/).reply(400);
		nock('https://api.ip2location.io').get(/.*/).reply(400);
		nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, geoIpMocks['fastly'].default);
		nock('https://ipinfo.io').get(/.*/).reply(400);
		nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(400);

		const info = await client.lookup(MOCK_IP).catch((error: Error) => error);

		expect(info).to.be.an.instanceof(Error);
		expect((info as Error).message).to.equal(`unresolvable geoip: ${MOCK_IP}`);
	});

	it('should detect US state', async () => {
		nockGeoIpProviders();

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			region: 'Northern America',
			normalizedRegion: 'northern america',
			normalizedCity: 'dallas',
			asn: 20001,
			latitude: 32.001,
			longitude: -96.001,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
		});
	});

	it('should filter out incomplete results', async () => {
		nockGeoIpProviders({ ipmap: 'emptyCity', ip2location: 'emptyCity', maxmind: 'emptyCity', fastly: 'emptyCity', ipinfo: 'argentina' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'BR',
			state: undefined,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedRegion: 'south america',
			normalizedCity: 'buenos aires',
			asn: 61004,
			latitude: -34.004,
			longitude: -58.004,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
		});
	});

	it('should query normalized city field', async () => {
		nockGeoIpProviders({ ipmap: 'newYork', ip2location: 'newYork', maxmind: 'newYork', fastly: 'newYork', ipinfo: 'newYork' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'NY',
			city: 'New York',
			region: 'Northern America',
			normalizedRegion: 'northern america',
			normalizedCity: 'new york',
			asn: 80001,
			latitude: 40.001,
			longitude: -74.001,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
		});
	});

	it('should pick another provider if prioritized don\'t have city value', async () => {
		nockGeoIpProviders({ ip2location: 'emptyCity', ipmap: 'emptyCity', maxmind: 'emptyCity' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			region: 'Northern America',
			normalizedRegion: 'northern america',
			normalizedCity: 'dallas',
			asn: 20004,
			latitude: 32.004,
			longitude: -96.004,
			network: 'Psychz Networks',
			normalizedNetwork: 'psychz networks',
		});
	});

	describe('network match', () => {
		it('should pick ipmap data + other provider network (missing network data)', async () => {
			nockGeoIpProviders({ ip2location: 'emptyCity' });

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedRegion: 'northern america',
				normalizedCity: 'dallas',
				asn: 20003,
				latitude: 32.002,
				longitude: -96.002,
				network: 'psychz networks',
				normalizedNetwork: 'psychz networks',
			});
		});

		it('should pick ipinfo data + fastly network (missing network data)', async () => {
			nockGeoIpProviders({ ip2location: 'emptyCity', ipmap: 'emptyCity', maxmind: 'emptyCity', ipinfo: 'emptyNetwork' });

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedRegion: 'northern america',
				normalizedCity: 'dallas',
				asn: 20005,
				latitude: 32.004,
				longitude: -96.004,
				network: 'psychz networks',
				normalizedNetwork: 'psychz networks',
			});
		});

		it('should pick ipinfo data + maxmind network (undefined network data)', async () => {
			nockGeoIpProviders({ ip2location: 'emptyCity', ipmap: 'emptyCity', maxmind: 'emptyCity', ipinfo: 'undefinedNetwork' });

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedRegion: 'northern america',
				normalizedCity: 'dallas',
				asn: 20005,
				latitude: 32.004,
				longitude: -96.004,
				network: 'psychz networks',
				normalizedNetwork: 'psychz networks',
			});
		});

		it('should fail (missing network data + city mismatch)', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'newYork', maxmind: 'emptyNetwork', ipinfo: 'emptyNetwork', fastly: 'emptyCity' });

			const info: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(info).to.be.instanceof(Error);
		});
	});

	describe('provider parsing', () => {
		describe('fastly', () => {
			it('should filter out "reserved" city name', async () => {
				nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, geoIpMocks['fastly'].reserved);

				const result = await fastlyLookup(MOCK_IP);

				expect(result).to.deep.equal({
					location: {
						continent: 'SA',
						country: 'AR',
						state: undefined,
						city: '',
						normalizedCity: '',
						asn: 61005,
						latitude: -34.005,
						longitude: -58.005,
						network: 'interbs s.r.l.',
						normalizedNetwork: 'interbs s.r.l.',
					},
					client: undefined,
				});
			});

			it('should filter out "private" city name', async () => {
				nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, geoIpMocks['fastly'].private);

				const result = await fastlyLookup(MOCK_IP);

				expect(result).to.deep.equal({
					location: {
						continent: 'SA',
						country: 'AR',
						state: undefined,
						city: '',
						normalizedCity: '',
						asn: 61005,
						latitude: -34.005,
						longitude: -58.005,
						network: 'interbs s.r.l.',
						normalizedNetwork: 'interbs s.r.l.',
					},
					client: undefined,
				});
			});
		});
	});

	describe('limit vpn/tor connection', () => {
		it('should pass - non-vpn', async () => {
			nockGeoIpProviders();

			const response: LocationInfo | Error = await client.lookup(MOCK_IP);

			expect(response).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedRegion: 'northern america',
				normalizedCity: 'dallas',
				asn: 20001,
				latitude: 32.001,
				longitude: -96.001,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
			});
		});

		it('should pass - no client object', async () => {
			nockGeoIpProviders({ fastly: 'noClient' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP);

			expect(response).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedRegion: 'northern america',
				normalizedCity: 'dallas',
				asn: 20001,
				latitude: 32.001,
				longitude: -96.001,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
			});
		});

		it('should pass - detect VPN (whitelisted)', async () => {
			const MOCK_IP = '5.134.119.43';

			mockFs({
				config: {
					'whitelist-ips.txt': `${MOCK_IP}`,
				},
			});

			nockGeoIpProviders({ fastly: 'proxyDescVpn' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP);

			expect(response).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedRegion: 'northern america',
				normalizedCity: 'dallas',
				asn: 20001,
				latitude: 32.001,
				longitude: -96.001,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
			});

			mockFs.restore();
		});

		it('should detect VPN (proxy_desc)', async () => {
			nockGeoIpProviders({ fastly: 'proxyDescVpn' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect TOR-EXIT (proxy_desc)', async () => {
			nockGeoIpProviders({ fastly: 'proxyDescTor' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect corporate (proxy_type)', async () => {
			nockGeoIpProviders({ fastly: 'proxyTypeCorporate' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect aol (proxy_type)', async () => {
			nockGeoIpProviders({ fastly: 'proxyTypeAol' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect anonymous (proxy_type)', async () => {
			nockGeoIpProviders({ fastly: 'proxyTypeAnonymous' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect blackberry (proxy_type)', async () => {
			nockGeoIpProviders({ fastly: 'proxyTypeBlackberry' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});
	});
});
