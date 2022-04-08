import {expect} from 'chai';
import {pingSchema, tracerouteSchema, dnsSchema} from '../../../../src/measurement/schema/command-schema.js';

describe('command schema', () => {
	describe('ping', () => {
		it('should fail (missing values)', async () => {
			const input = {
				type: 'ping',
			};

			const valid = pingSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass (target domain)', async () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
			};

			const valid = pingSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', async () => {
			const input = {
				type: 'ping',
				target: '1.1.1.1',
			};

			const valid = pingSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', async () => {
			const input = {
				type: 'ping',
				target: '300.300.300.300',
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

		it('should pass (target domain)', async () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
			};

			const valid = tracerouteSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', async () => {
			const input = {
				type: 'traceroute',
				target: '1.1.1.1',
			};

			const valid = tracerouteSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', async () => {
			const input = {
				type: 'traceroute',
				target: '300.300.300.300',
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

	describe('dns', () => {
		it('should fail (missing values)', async () => {
			const input = {
				type: 'dns',
			};

			const valid = dnsSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (invalid target format)', async () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
			};

			const valid = dnsSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass and correct values (incorrect caps)', async () => {
			const input = {
				type: 'DNS',
				target: 'abc.com',
				query: {
					type: 'a',
					protocol: 'tcp',
				},
			};

			const valid = dnsSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.query.protocol).to.equal('TCP');
			expect(valid.value.query.type).to.equal('A');
		});

		it('should pass (deep equal)', async () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				query: {
					type: 'A',
					resolver: '1.1.1.1',
					protocol: 'UDP',
					port: 53,
				},
			};

			const valid = dnsSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(input);
		});
	});
});
