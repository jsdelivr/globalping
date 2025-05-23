import { expect } from 'chai';
import * as sinon from 'sinon';
import * as td from 'testdouble';

describe('city approximation', () => {
	let getCity: any;
	let populateCitiesList: any;
	const sandbox = sinon.createSandbox();

	const redis = {
		geoAdd: sandbox.stub(),
		geoSearch: sandbox.stub(),
		zCard: sandbox.stub(),
	};

	before(async () => {
		await td.replaceEsm('../../../../src/lib/redis/client.ts', { getRedisClient: () => redis });
		({ populateCitiesList, getCity } = await import('../../../../src/lib/geoip/city-approximation.js'));
		await populateCitiesList();
	});

	beforeEach(() => {
		redis.geoAdd.reset();
		redis.geoSearch.reset();
		redis.zCard.resolves(25000);
	});

	after(() => {
		td.reset();
	});

	it('should return the passed city if that city is in the DC cities list', async () => {
		const city = await getCity({ city: 'Falkenstein', state: null }, 'DE', 31, 32);
		expect(redis.geoSearch.callCount).to.equal(0);
		expect(city).to.deep.equal({ city: 'Falkenstein', state: null });
	});

	it('should apply normalization before searching in the DC cities list', async () => {
		const city = await getCity({ city: 'The falkenstein', state: null }, 'DE', 31, 32);
		expect(redis.geoSearch.callCount).to.equal(0);
		expect(city).to.deep.equal({ city: 'The falkenstein', state: null });
	});

	it('should return approximated city if provided city is not in the DC cities list', async () => {
		redis.geoSearch.resolves([ '2803560' ]);

		const city = await getCity({ city: 'Lengenfeld', state: null }, 'DE', 31, 32);
		expect(redis.geoSearch.callCount).to.equal(1);
		expect(city).to.deep.equal({ city: 'Zwickau', state: null });
	});

	it('should return approximated city with max population if multiple cities were found', async () => {
		redis.geoSearch.resolves([ '4684888', '5128581', '5391959' ]);
		const city = await getCity({ city: 'Clifton', state: 'NJ' }, 'US', 31,	32);
		expect(city).to.deep.equal({ city: 'New York City', state: 'NY' });
	});

	it('should return initial city if no approximated city was found', async () => {
		redis.geoSearch.resolves([]);
		const city = await getCity({ city: 'Clifton', state: 'NJ' }, 'US', 31,	32);
		expect(city).to.deep.equal({ city: 'Clifton', state: 'NJ' });
	});

	it('should return initial city if some of the arguments are missing', async () => {
		const cities = await Promise.all([
			getCity({ city: '', state: null }, 'US', 31,	32),
			getCity({ city: 'Clifton', state: 'NJ' }, '', 31,	32),
			getCity({ city: 'Clifton', state: 'NJ' }, 'US', 0,	32),
			getCity({ city: 'Clifton', state: 'NJ' }, 'US', 31,	0),
		]);
		expect(redis.geoSearch.callCount).to.equal(0);

		expect(cities).to.deep.equal([
			{ city: '', state: null },
			{ city: 'Clifton', state: 'NJ' },
			{ city: 'Clifton', state: 'NJ' },
			{ city: 'Clifton', state: 'NJ' },
		]);
	});

	it('should not populate cities list during search', async () => {
		redis.geoSearch.resolves([ '5128581' ]);
		expect(redis.geoAdd.callCount).to.equal(0);
		const city = await getCity({ city: 'Clifton', state: 'NJ' }, 'US', 31,	32);
		expect(redis.geoAdd.callCount).to.equal(0);
		expect(city).to.deep.equal({ city: 'New York City', state: 'NY' });
	});

	it('should populate cities list automatically during search if it is empty', async () => {
		redis.geoSearch.resolves([ '5128581' ]);
		redis.zCard.resolves(0);
		expect(redis.geoAdd.callCount).to.equal(0);
		const city = await getCity({ city: 'Clifton', state: 'NJ' }, 'US', 31,	32);
		expect(redis.geoAdd.callCount).to.be.within(20, 30);
		expect(city).to.deep.equal({ city: 'New York City', state: 'NY' });
	});

	it('should populate cities list only once for multiple parallel searchs', async () => {
		redis.geoSearch.resolves([ '5128581' ]);
		redis.zCard.resolves(0);
		expect(redis.geoAdd.callCount).to.equal(0);

		const cities = await Promise.all([
			getCity({ city: 'Clifton', state: 'NJ' }, 'US', 31,	32),
			getCity({ city: 'Clifton', state: 'NJ' }, 'US', 31,	32),
			getCity({ city: 'Clifton', state: 'NJ' }, 'US', 31,	32),
		]);

		expect(redis.geoAdd.callCount).to.be.within(20, 30);

		expect(cities).to.deep.equal([
			{ city: 'New York City', state: 'NY' },
			{ city: 'New York City', state: 'NY' },
			{ city: 'New York City', state: 'NY' },
		]);
	});
});
