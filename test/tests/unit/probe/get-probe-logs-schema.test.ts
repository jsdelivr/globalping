import { expect } from 'chai';
import { schema } from '../../../../src/probe/schema/get-probe-logs-schema.js';

describe('getProbeLogsSchema', () => {
	it('trims and de-duplicates scopes', () => {
		const result = schema.validate({ scopes: ' system, worker,system,,api:connect, ' });

		expect(result.error).to.equal(undefined);
		expect(result.value.scopes).to.deep.equal([ 'system', 'worker', 'api:connect' ]);
	});
});
