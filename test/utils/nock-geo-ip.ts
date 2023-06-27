import * as fs from 'node:fs';
import nock from 'nock';

const mocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

type ProviderToMockname = {
  maxmind?: string;
  ipinfo?: string;
  fastly?: string;
};

const nockGeoIpProviders = ({ maxmind, ipinfo, fastly }: ProviderToMockname = {}) => {
	nock('https://geoip.maxmind.com/geoip/v2.1/city/').get(/.*/).reply(200, maxmind ? mocks.maxmind[maxmind] : mocks.maxmind.default);
	nock('https://ipinfo.io').get(/.*/).reply(200, ipinfo ? mocks.ipinfo[ipinfo] : mocks.ipinfo.default);
	nock('https://globalping-geoip.global.ssl.fastly.net').get(/.*/).reply(200, fastly ? mocks.fastly[fastly] : mocks.fastly.default);
};

export default nockGeoIpProviders;
