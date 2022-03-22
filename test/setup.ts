import nock from 'nock';

before(() => {
	nock.disableNetConnect();
	nock.enableNetConnect('127.0.0.1');
});
