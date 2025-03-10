import got from 'got';
import { expect } from 'chai';

describe('locations filter', () => {
	it('should create measurement without location', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} });

		expect(response.statusCode).to.equal(202);
	});

	it('should create measurement by valid "city" value', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: [{
				city: 'Buenos Aires',
			}],
		} });

		expect(response.statusCode).to.equal(202);
	});

	it('should not create measurement by invalid "city" value', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: [{
				city: 'Ouagadougou',
			}],
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(422);
	});

	it('should create measurement by valid "magic" value', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: [{
				magic: 'Buenos Aires',
			}],
		} });

		expect(response.statusCode).to.equal(202);
	});

	it('should not create measurement by invalid "magic" value', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: [{
				magic: 'Ouagadougou',
			}],
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(422);
	});

	it('should create measurement by id of another measurement', async () => {
		const { id } = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
		} }).json<any>();

		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: id,
		} });

		expect(response.statusCode).to.equal(202);
	});

	it('should not create measurement by wrong id', async () => {
		const response = await got.post('http://localhost:80/v1/measurements', { json: {
			target: 'www.jsdelivr.com',
			type: 'ping',
			locations: 'wrongIdValue',
		}, throwHttpErrors: false });

		expect(response.statusCode).to.equal(422);
	});
});
