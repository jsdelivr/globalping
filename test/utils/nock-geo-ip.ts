import * as fs from 'node:fs';
import nock from 'nock';

const mocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

type ProviderToMockname = {
  ipmap?: string;
  ip2location?: string;
  maxmind?: string;
  ipinfo?: string;
  fastly?: string;
};

const nockGeoIpProviders = (providersToMockname: ProviderToMockname = {}) => {
	Object.entries(providersToMockname).forEach(([ provider, mockname ]) => {
		if (mockname && !mocks[provider][mockname]) {
			throw new Error(`No ${mockname} mock for ${provider} provider`);
		}
	});

	const { ipmap, ip2location, maxmind, ipinfo, fastly } = providersToMockname;

	nock('https://ipmap-api.ripe.net/v1/locate/').get(/.*/).reply(200, ipmap ? mocks.ipmap[ipmap] : mocks.ipmap.default);
	nock('https://api.ip2location.io').get(/.*/).reply(200, ip2location ? mocks.ip2location[ip2location] : mocks.ip2location.default);
	nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(200, maxmind ? mocks.maxmind[maxmind] : mocks.maxmind.default);
	nock('https://ipinfo.io').get(/.*/).reply(200, ipinfo ? mocks.ipinfo[ipinfo] : mocks.ipinfo.default);
	nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, fastly ? mocks.fastly[fastly] : mocks.fastly.default);
};

export default nockGeoIpProviders;
