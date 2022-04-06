import * as fs from 'node:fs';
import nock from 'nock';
import {expect} from 'chai';
import {geoIpLookup, LocationInfo} from '../../../src/lib/geoip/client.js';

const mocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

describe('geoip service', () => {
	it('should use maxmind & digitalelement consensus', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get('/100.00.00.00')
			.reply(200, mocks['100.00.00.00'].fastly);

		nock('https://ipinfo.io')
			.get('/100.00.00.00')
			.reply(200, mocks['100.00.00.00'].ipinfo);

		const info = await geoIpLookup('100.00.00.00');

		expect(info).to.deep.equal({
			continent: 'SA',
			country: 'AR',
			state: undefined,
			city: 'buenos aires',
			asn: 61_493,
			latitude: -34.61,
			longitude: -58.42,
			network: 'interbs s.r.l.',
		});
	});

	it('should use ipinfo as a fallback', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get('/100.00.00.01')
			.reply(200, mocks['100.00.00.01'].fastly);

		nock('https://ipinfo.io')
			.get('/100.00.00.01')
			.reply(200, mocks['100.00.00.01'].ipinfo);

		const info = await geoIpLookup('100.00.00.01');

		expect(info).to.deep.equal({
			asn: 61_493,
			city: 'lagoa do carro',
			continent: 'SA',
			country: 'AR',
			latitude: -7.7568,
			longitude: -35.3656,
			state: undefined,
			network: 'interbs s.r.l.',
		});
	});

	it('should work when ipinfo is down', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get('/100.00.00.01')
			.reply(200, mocks['100.00.00.01'].fastly);

		nock('https://ipinfo.io')
			.get('/100.00.00.01')
			.reply(400);

		const info = await geoIpLookup('100.00.00.01');

		expect(info).to.deep.equal({
			asn: 61_493,
			city: 'buenos aires',
			continent: 'SA',
			country: 'AR',
			latitude: -34.61,
			longitude: -58.42,
			state: undefined,
			network: 'interbs s.r.l.',
		});
	});

	it('should work when fastly is down', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get('/100.00.00.01')
			.reply(400);

		nock('https://ipinfo.io')
			.get('/100.00.00.01')
			.reply(200, mocks['100.00.00.01'].ipinfo);

		const info = await geoIpLookup('100.00.00.01');

		expect(info).to.deep.equal({
			asn: 61_493,
			city: 'lagoa do carro',
			continent: 'SA',
			country: 'BR',
			latitude: -7.7568,
			longitude: -35.3656,
			state: undefined,
			network: 'interbs s.r.l. (baehost)',
		});
	});

	it('should detect US state', async () => {
		nock('https://globalping-geoip.global.ssl.fastly.net')
			.get('/100.00.00.02')
			.reply(200, mocks['100.00.00.02'].fastly);

		nock('https://ipinfo.io')
			.get('/100.00.00.02')
			.reply(200, mocks['100.00.00.02'].ipinfo);

		const info = await geoIpLookup('100.00.00.02');

		expect(info).to.deep.equal({
			asn: 40_676,
			city: 'dallas',
			continent: 'NA',
			country: 'US',
			latitude: 32.7492,
			longitude: -96.8389,
			state: 'TX',
			network: 'psychz networks',
		});
	});

	describe('limit vpn/tor connection', () => {
		it('should pass - non-vpn', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.00')
				.reply(200, mocks['100.00.01.00'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.00')
				.reply(200, mocks['100.00.01.00'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.00').catch((error: Error) => error);

			expect(response).to.deep.equal({
				asn: 40_676,
				city: 'dallas',
				continent: 'NA',
				country: 'US',
				latitude: 32.7492,
				longitude: -96.8389,
				state: 'TX',
				network: 'psychz networks',
			});
		});

		it('should pass - no client object', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.07')
				.reply(200, mocks['100.00.01.07'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.07')
				.reply(200, mocks['100.00.01.07'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.07').catch((error: Error) => error);

			expect(response).to.deep.equal({
				asn: 40_676,
				city: 'dallas',
				continent: 'NA',
				country: 'US',
				latitude: 32.7492,
				longitude: -96.8389,
				state: 'TX',
				network: 'psychz networks',
			});
		});

		it('should detect VPN (proxy_desc)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.01')
				.reply(200, mocks['100.00.01.01'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.01')
				.reply(200, mocks['100.00.01.01'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.01').catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect TOR-EXIT (proxy_desc)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.02')
				.reply(200, mocks['100.00.01.02'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.02')
				.reply(200, mocks['100.00.01.02'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.02').catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect TOR-RELAY (proxy_desc)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.03')
				.reply(200, mocks['100.00.01.03'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.03')
				.reply(200, mocks['100.00.01.03'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.03').catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect corporate (proxy_type)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.03')
				.reply(200, mocks['100.00.01.03'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.03')
				.reply(200, mocks['100.00.01.03'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.03').catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect aol (proxy_type)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.04')
				.reply(200, mocks['100.00.01.04'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.04')
				.reply(200, mocks['100.00.01.04'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.04').catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect anonymous (proxy_type)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.05')
				.reply(200, mocks['100.00.01.05'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.05')
				.reply(200, mocks['100.00.01.05'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.05').catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});

		it('should detect blackberry (proxy_type)', async () => {
			nock('https://globalping-geoip.global.ssl.fastly.net')
				.get('/100.00.01.06')
				.reply(200, mocks['100.00.01.06'].fastly);

			nock('https://ipinfo.io')
				.get('/100.00.01.06')
				.reply(200, mocks['100.00.01.06'].ipinfo);

			const response: LocationInfo | Error = await geoIpLookup('100.00.01.06').catch((error: Error) => error);

			expect(response).to.be.instanceof(Error);
			expect((response as Error).message).to.equal('vpn detected');
		});
	});
});
