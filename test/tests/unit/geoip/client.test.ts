import nock from 'nock';
import mockFs from 'mock-fs';
import { expect } from 'chai';
import GeoipClient, { type LocationInfo } from '../../../../src/lib/geoip/client.js';
import NullCache from '../../../../src/lib/cache/null-cache.js';
import nockGeoIpProviders from '../../../utils/nock-geo-ip.js';
import geoIpMocks from '../../../mocks/nock-geoip.json' assert { type: 'json' };
import { populateMemList } from '../../../../src/lib/geoip/whitelist.js';

const MOCK_IP = '131.255.7.26';

describe('geoip service', () => {
	const client = new GeoipClient(new NullCache());

	afterEach(() => {
		nock.cleanAll();
	});

	it('should choose top prioritized provider from the winners majority', async () => {
		nockGeoIpProviders({ ipmap: 'argentina', ip2location: 'default', maxmind: 'argentina', fastly: 'argentina', ipinfo: 'default' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: null,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedCity: 'buenos aires',
			asn: 61003,
			latitude: -34.61,
			longitude: -58.38,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
			isProxy: false,
			isHosting: true,
			isAnycast: null,
		});
	});

	it('should choose top prioritized provider if some providers are down', async () => {
		nock('https://ipmap-api.ripe.net/v1/locate/').get(/.*/).reply(400);
		nock('https://api.ip2location.io').get(/.*/).reply(400);
		nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, geoIpMocks.fastly.argentina);
		nock('https://ipinfo.io').get(/.*/).reply(200, geoIpMocks.ipinfo.argentina);
		nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(400);

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: null,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedCity: 'buenos aires',
			asn: 61004,
			latitude: -34.61,
			longitude: -58.38,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
			isProxy: null,
			isHosting: null,
			isAnycast: null,
		});
	});

	it('should fulfill ipmap network data with other provider network data with the same city', async () => {
		nockGeoIpProviders({ ipmap: 'default', ip2location: 'argentina', maxmind: 'newYork', ipinfo: 'empty', fastly: 'default' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			region: 'Northern America',
			normalizedCity: 'dallas',
			asn: 20005,
			latitude: 32.78,
			longitude: -96.81,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
			isProxy: false,
			isHosting: null,
			isAnycast: null,
		});
	});

	it('should fulfill missing data with other provider network data with the same city', async () => {
		nockGeoIpProviders({ ip2location: 'emptyNetwork', ipmap: 'default', maxmind: 'empty', ipinfo: 'empty', fastly: 'default' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			region: 'Northern America',
			normalizedCity: 'dallas',
			asn: 20005,
			latitude: 32.78,
			longitude: -96.81,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
			isProxy: false,
			isHosting: null,
			isAnycast: null,
		});
	});

	it('should choose top prioritized provider when there is a draw in returned results', async () => {
		nockGeoIpProviders({ ipmap: 'empty', ip2location: 'newYork', maxmind: 'newYork', ipinfo: 'argentina', fastly: 'argentina' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: null,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedCity: 'buenos aires',
			asn: 61004,
			latitude: -34.61,
			longitude: -58.38,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
			isProxy: false,
			isHosting: true,
			isAnycast: null,
		});
	});

	it('should choose top prioritized provider when all providers returned different cities', async () => {
		nockGeoIpProviders({ ipmap: 'default', ip2location: 'argentina', maxmind: 'newYork', ipinfo: 'empty', fastly: 'bangkok' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: null,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedCity: 'buenos aires',
			asn: 61001,
			latitude: -34.61,
			longitude: -58.38,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
			isProxy: false,
			isHosting: null,
			isAnycast: null,
		});
	});

	it('should fail when only fastly reports the data', async () => {
		nock('https://ipmap-api.ripe.net/v1/locate/').get(/.*/).reply(400);
		nock('https://api.ip2location.io').get(/.*/).reply(400);
		nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, geoIpMocks.fastly.default);
		nock('https://ipinfo.io').get(/.*/).reply(400);
		nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(400);

		const info = await client.lookup(MOCK_IP).catch((error: Error) => error);

		expect(info).to.be.an.instanceof(Error);
		expect((info as Error).message).to.equal(`unresolvable geoip: ${MOCK_IP}`);
	});

	it('should use provided cities when aproximated cities wasn\'t found', async () => {
		nockGeoIpProviders({ ipmap: 'emptyLocation', ip2location: 'emptyLocation', maxmind: 'emptyLocation', ipinfo: 'emptyLocation', fastly: 'emptyLocation' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'AF',
			country: 'EG',
			state: null,
			city: 'El-Rashda',
			region: 'Northern Africa',
			normalizedCity: 'el-rashda',
			asn: 20001,
			latitude: 23.88,
			longitude: 26.49,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
			isProxy: false,
			isHosting: null,
			isAnycast: null,
		});
	});

	it('should use provided cities when they are in a DC cities list', async () => {
		nockGeoIpProviders({ ip2location: 'falkenstein', ipmap: 'empty', maxmind: 'empty', ipinfo: 'empty', fastly: 'empty' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'EU',
			country: 'DE',
			state: null,
			city: 'Falkenstein',
			region: 'Western Europe',
			normalizedCity: 'falkenstein',
			asn: 24940,
			latitude: 50.48,
			longitude: 12.37,
			network: 'Hetzner Online GmbH',
			normalizedNetwork: 'hetzner online gmbh',
			isProxy: false,
			isHosting: null,
			isAnycast: null,
		});
	});

	it('should use approximated cities when they are not in a DC cities list', async () => {
		nockGeoIpProviders({ ip2location: 'lengenfeld', ipmap: 'empty', maxmind: 'empty', ipinfo: 'empty', fastly: 'empty' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'EU',
			country: 'DE',
			state: null,
			city: 'Zwickau',
			region: 'Western Europe',
			normalizedCity: 'zwickau',
			asn: 24940,
			latitude: 50.48,
			longitude: 12.37,
			network: 'Hetzner Online GmbH',
			normalizedNetwork: 'hetzner online gmbh',
			isProxy: false,
			isHosting: null,
			isAnycast: null,
		});
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
			normalizedCity: 'dallas',
			asn: 20004,
			latitude: 32.78,
			longitude: -96.81,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
			isProxy: false,
			isHosting: true,
			isAnycast: null,
		});
	});

	it('should filter out incomplete results', async () => {
		nockGeoIpProviders({ ipmap: 'empty', ip2location: 'empty', maxmind: 'argentina', fastly: 'empty', ipinfo: 'empty' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: null,
			city: 'Buenos Aires',
			region: 'South America',
			normalizedCity: 'buenos aires',
			asn: 61003,
			latitude: -34.61,
			longitude: -58.38,
			network: 'InterBS S.R.L. (BAEHOST)',
			normalizedNetwork: 'interbs s.r.l. (baehost)',
			isProxy: false,
			isHosting: null,
			isAnycast: null,
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
			normalizedCity: 'new york',
			asn: 80004,
			latitude: 40.71,
			longitude: -74.01,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
			isProxy: false,
			isHosting: true,
			isAnycast: null,
		});
	});

	it('should pick another provider if prioritized doesn\'t have city value', async () => {
		nockGeoIpProviders({ ip2location: 'emptyCity', ipinfo: 'emptyCity', maxmind: 'emptyCity' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			region: 'Northern America',
			normalizedCity: 'dallas',
			asn: 20005,
			latitude: 32.78,
			longitude: -96.81,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
			isProxy: false,
			isHosting: null,
			isAnycast: null,
		});
	});

	it(`should set 'isAnycast: true' if ipinfo returned that it is anycast ip`, async () => {
		nockGeoIpProviders({ ipinfo: 'anycast' });

		const info = await client.lookup(MOCK_IP);

		expect(info).to.deep.equal({
			continent: 'NA',
			country: 'US',
			state: 'TX',
			city: 'Dallas',
			region: 'Northern America',
			normalizedCity: 'dallas',
			asn: 20004,
			latitude: 32.78,
			longitude: -96.81,
			network: 'The Constant Company LLC',
			normalizedNetwork: 'the constant company llc',
			isProxy: false,
			isHosting: true,
			isAnycast: true,
		});
	});

	describe('network match', () => {
		it('should pick ipmap data + other provider network (missing network data)', async () => {
			nockGeoIpProviders({ ip2location: 'empty', ipinfo: 'empty', maxmind: 'empty' });

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedCity: 'dallas',
				asn: 20005,
				latitude: 32.78,
				longitude: -96.81,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
				isProxy: false,
				isHosting: null,
				isAnycast: null,
			});
		});

		it('should pick ipinfo data + fastly network (missing network data)', async () => {
			nockGeoIpProviders({ ip2location: 'empty', ipmap: 'empty', maxmind: 'empty', ipinfo: 'emptyNetwork' });

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedCity: 'dallas',
				asn: 20005,
				latitude: 32.78,
				longitude: -96.81,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
				isProxy: false,
				isHosting: null,
				isAnycast: null,
			});
		});

		it('should pick ipinfo data + fastly network (undefined network data)', async () => {
			nockGeoIpProviders({ ip2location: 'empty', ipmap: 'empty', maxmind: 'empty', ipinfo: 'undefinedNetwork' });

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedCity: 'dallas',
				asn: 20005,
				latitude: 32.78,
				longitude: -96.81,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
				isProxy: false,
				isHosting: null,
				isAnycast: null,
			});
		});

		it('should correctly parse states with the "of" substring inside the name', async () => {
			nockGeoIpProviders({ ip2location: 'washington', ipmap: 'empty', maxmind: 'empty', ipinfo: 'empty', fastly: 'empty' });

			const info = await client.lookup(MOCK_IP);

			expect(info).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'DC',
				city: 'Washington',
				region: 'Northern America',
				normalizedCity: 'washington',
				asn: 40676,
				latitude: 38.90,
				longitude: -77.04,
				network: 'Psychz Networks',
				normalizedNetwork: 'psychz networks',
				isProxy: false,
				isHosting: true,
				isAnycast: null,
			});

			nockGeoIpProviders({ ip2location: 'empty', ipmap: 'empty', maxmind: 'empty', ipinfo: 'washington', fastly: 'empty' });

			const info2 = await client.lookup(MOCK_IP);

			expect(info2).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'DC',
				city: 'Washington',
				region: 'Northern America',
				normalizedCity: 'washington',
				asn: 701,
				latitude: 38.90,
				longitude: -77.04,
				network: 'Verizon Business',
				normalizedNetwork: 'verizon business',
				isProxy: false,
				isHosting: null,
				isAnycast: null,
			});
		});

		it('should fail (missing network data + city mismatch)', async () => {
			nockGeoIpProviders({ ip2location: 'argentina', ipmap: 'newYork', maxmind: 'emptyNetwork', ipinfo: 'emptyNetwork', fastly: 'empty' });

			const info: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(info).to.be.instanceof(Error);
		});
	});

	describe('limit vpn connection', () => {
		afterEach(() => {
			mockFs.restore();
		});

		it('should pass - non-vpn', async () => {
			nockGeoIpProviders();

			const response: LocationInfo | Error = await client.lookup(MOCK_IP);

			expect(response).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedCity: 'dallas',
				asn: 20004,
				latitude: 32.78,
				longitude: -96.81,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
				isProxy: false,
				isHosting: true,
				isAnycast: null,
			});
		});

		it('should pass - no is_proxy field', async () => {
			nockGeoIpProviders({ ip2location: 'noVpn' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP);

			expect(response).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedCity: 'dallas',
				asn: 20004,
				latitude: 32.78,
				longitude: -96.81,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
				isProxy: false,
				isHosting: true,
				isAnycast: null,
			});
		});

		it('should pass - is_proxy field is true (whitelisted)', async () => {
			mockFs({
				config: {
					'whitelist-ips.txt': '1.1.1.1',
				},
			});

			await populateMemList();

			nockGeoIpProviders({ ip2location: 'vpn' });

			const response: LocationInfo | Error = await client.lookup('1.1.1.1');

			expect(response).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedCity: 'dallas',
				asn: 20004,
				latitude: 32.78,
				longitude: -96.81,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
				isProxy: false,
				isHosting: true,
				isAnycast: null,
			});
		});

		it('should pass - is_proxy field is true (whitelisted range)', async () => {
			mockFs({
				config: {
					'whitelist-ips.txt': '1.1.1.0/24',
				},
			});

			await populateMemList();

			nockGeoIpProviders({ ip2location: 'vpn' });

			const response: LocationInfo | Error = await client.lookup('1.1.1.1');

			expect(response).to.deep.equal({
				continent: 'NA',
				country: 'US',
				state: 'TX',
				city: 'Dallas',
				region: 'Northern America',
				normalizedCity: 'dallas',
				asn: 20004,
				latitude: 32.78,
				longitude: -96.81,
				network: 'The Constant Company LLC',
				normalizedNetwork: 'the constant company llc',
				isProxy: false,
				isHosting: true,
				isAnycast: null,
			});
		});

		it('should reject - (not in whitelisted range)', async () => {
			mockFs({
				config: {
					'whitelist-ips.txt': `1.1.2.0/24`,
				},
			});

			await populateMemList();

			nockGeoIpProviders({ ip2location: 'vpn' });

			const response: LocationInfo | Error = await client.lookup('1.1.1.1').catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should reject - is_proxy field is true', async () => {
			nockGeoIpProviders({ ip2location: 'vpn' });

			const response: LocationInfo | Error = await client.lookup(MOCK_IP).catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});
	});
});
