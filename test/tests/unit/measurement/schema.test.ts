import {expect} from 'chai';
import {pingSchema} from '../../../../src/measurement/schema/command-schema.js';

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

		it('should pass (deel equal)', async () => {
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
});
