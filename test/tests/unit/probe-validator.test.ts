import { expect } from 'chai';
import { probeValidator } from '../../../src/lib/probe-validator.js';

describe('ProbeValidator', () => {
	it('should pass through valid probe id', async () => {
		probeValidator.addValidIds('measurement-id', 'test-id', 'probe-uuid');
		probeValidator.validateProbe('measurement-id', 'test-id', 'probe-uuid');
	});

	it('should throw for invalid probe id', async () => {
		probeValidator.addValidIds('measurement-id', 'test-id', 'probe-uuid');
		expect(() => probeValidator.validateProbe('measurement-id', 'test-id', 'invalid-probe-uuid')).to.throw();
	});

	it('should throw for missing key', async () => {
		expect(() => probeValidator.validateProbe('missing-measurement-id', 'test-id', 'probe-uuid')).to.throw();
	});
});
