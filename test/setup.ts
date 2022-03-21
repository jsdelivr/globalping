import fs from 'node:fs';
import nock from 'nock';

const mocks = JSON.parse(fs.readFileSync('./test/mocks/nock-geoip.json').toString()) as Record<string, any>;

before(() => {
	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');

	// Mocked probe geoip info
	nock('https://globalping-geoip.global.ssl.fastly.net')
		.get('/100.10.10.1')
		.reply(200, mocks['100.10.10.1'].fastly)
		.persist();

	nock('https://ipinfo.io')
		.get('/100.10.10.1')
		.reply(200, mocks['100.10.10.1'].ipinfo)
		.persist();
});
