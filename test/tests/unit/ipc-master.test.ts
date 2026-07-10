import { expect } from 'chai';
import { getHandler } from '../../../src/lib/ipc/ipc-master.js';

describe('IPC', () => {
	describe('getHandler', () => {
		it('should resolve the credits consume handler', () => {
			expect(getHandler('credits', 'consume')).to.be.a('function');
		});

		it('should resolve the credits getRemainingCredits handler', () => {
			expect(getHandler('credits', 'getRemainingCredits')).to.be.a('function');
		});

		it('should throw for an unknown method', () => {
			expect(() => getHandler('credits', 'somethingElse')).to.throw('Unknown method "somethingElse" for target "credits".');
		});

		it('should throw for an unknown target', () => {
			expect(() => getHandler('other', 'consume')).to.throw('Unknown method "consume" for target "other".');
		});
	});
});
