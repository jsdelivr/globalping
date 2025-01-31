import { expect } from 'chai';
import * as sinon from 'sinon';
import { ProbeValidator } from '../../../src/lib/probe-validator.js';
import { RedisCluster } from '../../../src/lib/redis/shared.js';

describe('ProbeValidator', () => {
	const sandbox = sinon.createSandbox();
	const redis = { hGet: sandbox.stub() };
	const probeValidator = new ProbeValidator(redis as unknown as RedisCluster);

	beforeEach(() => {
		redis.hGet.resolves(undefined);
	});

	it('should pass through valid probe id', async () => {
		probeValidator.addValidIds('measurement-id', 'test-id', 'probe-uuid');
		await probeValidator.validateProbe('measurement-id', 'test-id', 'probe-uuid');
	});

	it('should throw for invalid probe id', async () => {
		probeValidator.addValidIds('measurement-id', 'test-id', 'probe-uuid');
		const error = await probeValidator.validateProbe('measurement-id', 'test-id', 'invalid-probe-uuid').catch(err => err);
		expect(error.message).to.equal('Probe ID is wrong for key measurement-id_test-id. Expected: probe-uuid, actual: invalid-probe-uuid');
	});

	it('should throw for missing key', async () => {
		const error = await probeValidator.validateProbe('missing-measurement-id', 'test-id', 'probe-uuid').catch(err => err);
		expect(error.message).to.equal('Probe ID not found for key missing-measurement-id_test-id');
	});

	it('should search key in redis if not found locally', async () => {
		redis.hGet.resolves('probe-uuid');
		await probeValidator.validateProbe('only-redis-measurement-id', 'test-id', 'probe-uuid');
	});

	it('should throw if redis probe id is different', async () => {
		redis.hGet.resolves('different-probe-uuid');
		const error = await probeValidator.validateProbe('only-redis-measurement-id', 'test-id', 'probe-uuid').catch(err => err);
		expect(error.message).to.equal('Probe ID is wrong for key only-redis-measurement-id_test-id. Expected: different-probe-uuid, actual: probe-uuid');
	});
});
