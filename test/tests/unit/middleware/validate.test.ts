import { expect } from 'chai';
import Joi from 'joi';
import * as sinon from 'sinon';
import { validate } from '../../../../src/lib/http/middleware/validate.js';

describe('Validate middleware', () => {
	const schema = Joi.object({
		hello: Joi.string().valid('world!').required(),
	});
	const nextMock = sinon.stub();

	beforeEach(() => {
		nextMock.reset();
	});

	it('should call next', async () => {
		const ctx: any = { request: { body: { hello: 'world!' } } };
		const next = sinon.stub();

		await validate(schema)(ctx, next);

		expect(next.calledOnce).to.be.true;
		expect(ctx.status).to.not.exist;
	});

	it('should return validation error', async () => {
		const ctx: any = { request: { body: { hello: 'no one' } } };

		await validate(schema)(ctx, nextMock);

		expect(nextMock.notCalled).to.be.true;

		expect(ctx.status).to.equal(400);

		expect(ctx.body).to.deep.equal({
			error: {
				message: 'Parameter validation failed.',
				type: 'validation_error',
				params: { hello: '"hello" must be [world!]' },
			},
		});
	});

	it('should normalise incorrect input case', async () => {
		const ctx: any = { request: { body: { input: 'text' } } };

		const schema = Joi.object({
			input: Joi.string().valid('TEXT').insensitive().required(),
		});

		await validate(schema)(ctx, nextMock);

		expect(ctx.request.body.input).to.equal('TEXT');
	});
});
