import {expect} from 'chai';
import {schema as locationSchema} from '../../../../src/measurement/schema/location-schema.js';
import {
	pingSchema,
	tracerouteSchema,
	dnsSchema,
	mtrSchema,
	httpSchema,
	joiValidateTarget,
} from '../../../../src/measurement/schema/command-schema.js';

describe('command schema', () => {
	describe('location', () => {
		describe('input case', () => {
			it('should correct network name', () => {
				const input = [
					{
						network: 'VIRGIN MEDIA',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value[0]!.network).to.equal(input[0]!.network.toLowerCase());
				expect(valid.value[0]!.network).to.not.equal(input[0]!.network);
			});

			it('should correct city value', () => {
				const input = [
					{
						city: 'LONDON',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value[0]!.city).to.equal(input[0]!.city.toLowerCase());
				expect(valid.value[0]!.city).to.not.equal(input[0]!.city);
			});
		});

		describe('magic', () => {
			it('should fail (too short)', () => {
				const input = [
					{
						magic: '',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.error).to.exist;
				expect(valid.error!.details[0]!.message).to.equal('"[0].magic" is not allowed to be empty');
			});

			it('should fail (not string)', () => {
				const input = [
					{
						magic: 1337,
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.error).to.exist;
				expect(valid.error!.details[0]!.message).to.equal('"[0].magic" must be a string');
			});

			it('should succeed', () => {
				const input = [
					{
						magic: 'cyprus',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.error).to.not.exist;
			});
		});
	});

	describe('target validator', () => {
		it('should fail (ip type) (private ip)', async () => {
			const input = '192.168.0.101';

			let result: string | Error = '';
			try {
				result = joiValidateTarget('ip')(input);
			} catch (error: unknown) {
				if (error instanceof Error) {
					result = error;
				}
			}

			expect(result).to.be.instanceof(Error);
		});

		it('should fail (any type) (private ip)', async () => {
			const input = '192.168.0.101';

			let result: string | Error = '';
			try {
				result = joiValidateTarget('any')(input);
			} catch (error: unknown) {
				if (error instanceof Error) {
					result = error;
				}
			}

			expect(result).to.be.instanceof(Error);
		});

		it('should suceed (any type) (domain)', async () => {
			const input = '1337.com';

			let result: string | Error = '';
			try {
				result = joiValidateTarget('any')(input);
			} catch (error: unknown) {
				if (error instanceof Error) {
					result = error;
				}
			}

			expect(typeof result).to.equal('string');
		});
	});

	describe('ping', () => {
		it('should fail (private ip)', async () => {
			const input = {
				type: 'ping',
				target: '192.168.0.101',
			};

			const valid = pingSchema.validate(input);

			expect(valid.error).to.exist;
		});

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

		it('should pass (trace enabled)', async () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				query: {
					trace: true,
					type: 'a',
					protocol: 'tcp',
				},
			};

			const valid = dnsSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.query.trace).to.equal(true);
			expect(valid.value.query.protocol).to.equal('TCP');
			expect(valid.value.query.type).to.equal('A');
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
					trace: false,
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

	describe('mtr', () => {
		it('should fail (missing values)', async () => {
			const input = {
				type: 'mtr',
			};

			const valid = mtrSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass (target domain)', async () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
			};

			const valid = mtrSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', async () => {
			const input = {
				type: 'mtr',
				target: '1.1.1.1',
			};

			const valid = mtrSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', async () => {
			const input = {
				type: 'mtr',
				target: '300.300.300.300',
			};

			const valid = mtrSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass and correct values (incorrect caps)', async () => {
			const input = {
				type: 'MtR',
				target: 'abc.com',
				protocol: 'udp',
			};

			const valid = mtrSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('mtr');
			expect(valid.value.protocol).to.equal('UDP');
		});

		it('should pass (deep equal)', async () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
				protocol: 'TCP',
				packets: 10,
				port: 80,
			};

			const valid = mtrSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(input);
		});
	});

	describe('http schema', () => {
		it('should fail (unsupported resolver format)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				query: {
					host: '',
					resolver: 'abc',
					protocol: 'https',
					port: 443,
					headers: {
						test: 'abc',
					},
					method: 'GET',
				},
			};

			const valid = httpSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (unsupported method)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				query: {
					host: '',
					protocol: 'https',
					port: 443,
					headers: {
						test: 'abc',
					},
					method: 'POST',
				},
			};

			const valid = httpSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (unsupported protocol)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				query: {
					method: 'GET',
					host: '',
					port: 443,
					headers: {
						test: 'abc',
					},
					protocol: 'rtmp',
				},
			};

			const valid = httpSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass (empty port)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				query: {
					method: 'GET',
					host: 'elocast.com',
					protocol: 'https',
					headers: {
						test: 'abc',
					},
				},
			};

			const desiredOutput = {
				type: 'http',
				target: 'elocast.com',
				query: {
					method: 'get',
					host: 'elocast.com',
					protocol: 'https',
					path: '/',
					headers: {test: 'abc'},
				},
			};

			const valid = httpSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				query: {
					method: 'GET',
					host: 'elocast.com',
					protocol: 'https',
					port: 443,
					headers: {
						test: 'abc',
					},
				},
			};

			const desiredOutput = {
				type: 'http',
				target: 'elocast.com',
				query: {
					method: 'get',
					host: 'elocast.com',
					protocol: 'https',
					path: '/',
					port: 443,
					headers: {test: 'abc'},
				},
			};

			const valid = httpSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});
});
