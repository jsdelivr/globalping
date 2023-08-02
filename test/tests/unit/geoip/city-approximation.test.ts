import { expect } from 'chai';
import * as sinon from 'sinon';
import * as td from 'testdouble';

describe('city approximation', () => {
	let getApproximatedCity: any;
	let populateCitiesList: any;

	const redis = {
		geoAdd: sinon.stub(),
		geoSearch: sinon.stub(),
		zCard: sinon.stub(),
	};

	before(async () => {
		await td.replaceEsm('../../../../src/lib/redis/client.ts', { getRedisClient: () => redis });
		({ populateCitiesList, getApproximatedCity } = await import('../../../../src/lib/geoip/city-approximation.js'));
		await populateCitiesList();
	});

	beforeEach(() => {
		redis.geoAdd.reset();
		redis.geoSearch.resolves([ '4684888' ]);
		redis.zCard.resolves(0);
	});

	after(() => {
		td.reset();
	});

	it('should return city with max population if multiple cities were found', async () => {
		redis.geoSearch.resolves([ '4684888', '5128581', '5391959' ]);
		const city = await getApproximatedCity('US', 31,	32);
		expect(city).to.equal('New York City');
	});

	it('should return null if no city was found', async () => {
		redis.geoSearch.resolves([]);
		const city = await getApproximatedCity('US', 31,	32);
		expect(city).to.equal(null);
	});

	it('should return null if some of the arguments are missing', async () => {
		const cities = await Promise.all([
			getApproximatedCity('', 31,	32),
			getApproximatedCity('US', 0,	32),
			getApproximatedCity('US', 31,	0),
		]);
		expect(cities).to.deep.equal([ null, null, null ]);
	});

	it('should populate cities list automatically if it is empty during search', async () => {
		expect(redis.geoAdd.callCount).to.equal(0);
		const city = await getApproximatedCity('US', 31,	32);
		expect(redis.geoAdd.callCount).to.equal(23);
		expect(city).to.equal('Dallas');
	});

	it('should populate cities list only once if it is empty for multiple parallel searchs', async () => {
		expect(redis.geoAdd.callCount).to.equal(0);

		const cities = await Promise.all([
			getApproximatedCity('US', 31,	32),
			getApproximatedCity('US', 31,	32),
			getApproximatedCity('US', 31,	32),
		]);

		expect(redis.geoAdd.callCount).to.equal(23);
		expect(cities).to.deep.equal([ 'Dallas', 'Dallas', 'Dallas' ]);
	});
});
