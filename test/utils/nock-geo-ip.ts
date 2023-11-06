import nock from 'nock';
import geoIpMocks from '../mocks/nock-geoip.json' assert { type: 'json' };

type ProviderToMockname = {
  ipmap?: keyof(typeof geoIpMocks.ipmap);
  ip2location?: keyof(typeof geoIpMocks.ip2location);
  maxmind?: keyof(typeof geoIpMocks.maxmind);
  ipinfo?: keyof(typeof geoIpMocks.ipinfo);
  fastly?: keyof(typeof geoIpMocks.fastly);
};

const nockGeoIpProviders = (providersToMockname: ProviderToMockname = {}) => {
	const mockNames: Required<ProviderToMockname> = {
		ipmap: 'default',
		ip2location: 'default',
		maxmind: 'default',
		ipinfo: 'default',
		fastly: 'default',
		...providersToMockname,
	};

	nock('https://ipmap-api.ripe.net/v1/locate/').get(/.*/).reply(200, geoIpMocks.ipmap[mockNames.ipmap]);
	nock('https://api.ip2location.io').get(/.*/).reply(200, geoIpMocks.ip2location[mockNames.ip2location]);
	nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(200, geoIpMocks.maxmind[mockNames.maxmind]);
	nock('https://ipinfo.io').get(/.*/).reply(200, geoIpMocks.ipinfo[mockNames.ipinfo]);
	nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, geoIpMocks.fastly[mockNames.fastly]);
};

export default nockGeoIpProviders;
