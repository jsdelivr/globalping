import {expect} from 'chai';
import {pingSchema, tracerouteSchema} from '../../../../src/measurement/schema/command-schema.js';

describe('command schema', () => {
	describe('ping', () => {
		it('should fail (missing values)', async () => {
			const input = {
				type: 'ping',
			};

			const valid = pingSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass and correct values (incorrect capitalization)', async () => {
			const input = {
				type: 'PING',
				target: 'abc.com',
			};

			const valid = pingSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('ping');
		});

		it('should pass (deep equal)', async () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
				packets: 1,
			};

			const valid = pingSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(input);
		});
	});

	describe('traceroute', () => {
		it('should fail (missing values)', async () => {
			const input = {
				type: 'traceroute',
			};

			const valid = tracerouteSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass and correct values (incorrect caps)', async () => {
			const input = {
				type: 'TRACEroute',
				target: 'abc.com',
				protocol: 'udp',
			};

			const valid = tracerouteSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('traceroute');
			expect(valid.value.protocol).to.equal('UDP');
		});

		it('should pass (deep equal)', async () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
				protocol: 'TCP',
				port: 80,
			};

			const valid = tracerouteSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(input);
		});
	});
});
