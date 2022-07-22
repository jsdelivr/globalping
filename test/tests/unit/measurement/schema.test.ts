import {expect} from 'chai';
import {
	schema as globalSchema,
} from '../../../../src/measurement/schema/global-schema.js';
import {
	schema as locationSchema,
} from '../../../../src/measurement/schema/location-schema.js';

import {joiValidateTarget} from '../../../../src/measurement/schema/utils.js';

describe('command schema', () => {
	describe('global', () => {
		describe('limits', () => {
			it('should correct limit (1 by default)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [],
					measurement: {},
				};

				const valid = globalSchema.validate(input);

				expect(valid.value.limit).to.equal(1);
			});

			it('should return an error (global + local limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [
						{city: 'milan', limit: 1},
					],
					measurement: {},
					limit: 1,
				};

				const valid = globalSchema.validate(input);

				expect(valid?.error?.details?.[0]?.message).to.equal('limit per location is not allowed when a global limit is set');
			});

			it('should pass (2 locations - no limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [
						{city: 'milan'},
						{city: 'london'},
					],
					measurement: {},
				};

				const valid = globalSchema.validate(input);

				expect(valid.value.limit).to.equal(input.locations.length);
				expect(valid.error).to.not.exist;
			});

			it('should pass - correct the global limit (location - no limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [
						{city: 'milan'},
					],
					measurement: {},
				};

				const valid = globalSchema.validate(input);

				expect(valid.value.limit).to.equal(1);
			});
		});

		describe('type matching', () => {
			describe('measurement options', () => {
				it('ping', () => {
					const input = {
						type: 'ping',
						target: 'abc.com',
						measurement: {
							packets: 1,
						},
					};

					const valid = globalSchema.validate(input);

					expect(valid.error).to.not.exist;
				});

				it('traceroute', async () => {
					const input = {
						type: 'traceroute',
						target: 'abc.com',
						measurement: {
							protocol: 'TCP',
							port: 80,
						},
					};

					const valid = globalSchema.validate(input);

					expect(valid.error).to.not.exist;
				});

				it('dns', async () => {
					const input = {
						type: 'dns',
						target: 'abc.com',
						measurement: {
							query: {
								type: 'A',
								trace: false,
								resolver: '1.1.1.1',
								protocol: 'UDP',
								port: 53,
							},
						},
					};

					const valid = globalSchema.validate(input);

					expect(valid.error).to.not.exist;
				});

				it('mtr', async () => {
					const input = {
						type: 'mtr',
						target: 'abc.com',
						measurement: {
							protocol: 'TCP',
							packets: 10,
							port: 80,
						},
					};

					const valid = globalSchema.validate(input);

					expect(valid.error).to.not.exist;
				});

				it('http', () => {
					const input = {
						type: 'http',
						target: 'elocast.com',
						measurement: {
							query: {
								method: 'GET',
								host: 'elocast.com',
								protocol: 'https',
								port: 443,
								headers: {
									test: 'abc',
								},
							},
						},
					};

					const valid = globalSchema.validate(input);

					expect(valid.error).to.not.exist;
				});
			});
		});
	});

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
				measurement: {},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (ipv6)', async () => {
			const input = {
				type: 'ping',
				target: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
				measurement: {},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (missing values)', async () => {
			const input = {
				type: 'ping',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass (target domain)', async () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', async () => {
			const input = {
				type: 'ping',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', async () => {
			const input = {
				type: 'ping',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass and correct values (incorrect capitalization)', async () => {
			const input = {
				type: 'PING',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('ping');
		});

		it('should pass (deep equal)', async () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
				measurement: {
					packets: 1,
				},
			};

			const desiredOutput = {
				...input,
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('traceroute', () => {
		it('should fail (missing values)', async () => {
			const input = {
				type: 'traceroute',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (ipv6)', async () => {
			const input = {
				type: 'traceroute',
				target: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass (target domain)', async () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', async () => {
			const input = {
				type: 'traceroute',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', async () => {
			const input = {
				type: 'traceroute',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass and correct values (incorrect caps)', async () => {
			const input = {
				type: 'TRACEroute',
				target: 'abc.com',
				measurement: {
					protocol: 'udp',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('traceroute');
			expect(valid.value.measurement.protocol).to.equal('UDP');
		});

		it('should pass (deep equal)', async () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
				measurement: {
					protocol: 'TCP',
					port: 80,
				},
			};

			const desiredOutput = {
				...input,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('dns', () => {
		it('should fail (missing values)', async () => {
			const input = {
				type: 'dns',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (invalid target format)', async () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (ipv6 resolver)', async () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
				query: {
					resolver: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass (trace enabled)', async () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurement: {
					query: {
						trace: true,
						type: 'a',
						protocol: 'tcp',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurement.query.trace).to.equal(true);
			expect(valid.value.measurement.query.protocol).to.equal('TCP');
			expect(valid.value.measurement.query.type).to.equal('A');
		});

		it('should pass and correct values (incorrect caps)', async () => {
			const input = {
				type: 'DNS',
				target: 'abc.com',
				measurement: {
					query: {
						type: 'a',
						protocol: 'tcp',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurement.query.protocol).to.equal('TCP');
			expect(valid.value.measurement.query.type).to.equal('A');
		});

		it('should pass (deep equal)', async () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurement: {
					query: {
						type: 'A',
						trace: false,
						resolver: '1.1.1.1',
						protocol: 'UDP',
						port: 53,
					},
				},
			};

			const desiredOutput = {
				...input,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('mtr', () => {
		it('should fail (missing values)', async () => {
			const input = {
				type: 'mtr',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (ipv6 target)', async () => {
			const input = {
				type: 'mtr',
				target: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass (target domain)', async () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', async () => {
			const input = {
				type: 'mtr',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', async () => {
			const input = {
				type: 'mtr',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass and correct values (incorrect caps)', async () => {
			const input = {
				type: 'MtR',
				target: 'abc.com',
				measurement: {
					protocol: 'udp',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('mtr');
			expect(valid.value.measurement.protocol).to.equal('UDP');
		});

		it('should pass (deep equal)', async () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
				measurement: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
				},
			};

			const desiredOutput = {
				...input,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('http schema', () => {
		it('should fail (unsupported resolver format)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurement: {
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
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (ipv6 resolver)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurement: {
					query: {
						host: '',
						resolver: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
						protocol: 'https',
						port: 443,
						headers: {
							test: 'abc',
						},
						method: 'GET',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (unsupported method)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurement: {
					query: {
						host: '',
						protocol: 'https',
						port: 443,
						headers: {
							test: 'abc',
						},
						method: 'POST',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should fail (unsupported protocol)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurement: {
					query: {
						method: 'GET',
						host: '',
						port: 443,
						headers: {
							test: 'abc',
						},
						protocol: 'rtmp',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
		});

		it('should pass (empty port)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurement: {
					query: {
						method: 'GET',
						host: 'elocast.com',
						protocol: 'https',
						headers: {
							test: 'abc',
						},
					},
				},
			};

			const desiredOutput = {
				type: 'http',
				target: 'elocast.com',
				measurement: {
					query: {
						method: 'get',
						host: 'elocast.com',
						protocol: 'https',
						path: '/',
						headers: {test: 'abc'},
					},
				},
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurement: {
					query: {
						method: 'GET',
						host: 'elocast.com',
						protocol: 'https',
						port: 443,
						headers: {
							test: 'abc',
						},
					},
				},
			};

			const desiredOutput = {
				type: 'http',
				target: 'elocast.com',
				measurement: {
					query: {
						method: 'get',
						host: 'elocast.com',
						protocol: 'https',
						path: '/',
						port: 443,
						headers: {test: 'abc'},
					},
				},
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});
});
