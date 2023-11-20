import { expect } from 'chai';
import Joi from 'joi';
import {
	schema as globalSchema,
} from '../../../../../src/measurement/schema/global-schema.js';
import {
	schema as locationSchema,
} from '../../../../../src/measurement/schema/location-schema.js';
import {
	joiValidateTarget,
	joiValidateDomain,
} from '../../../../../src/measurement/schema/utils.js';
import { populateDomainList, populateIpList } from '../../../../utils/populate-static-files.js';

describe('command schema', async () => {
	before(async () => {
		await populateIpList();
		await populateDomainList();
	});

	describe('global', () => {
		describe('limits', () => {
			it('should correct limit (1 by default)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [],
					measurementOptions: {},
				};

				const valid = globalSchema.validate(input);

				expect(valid.value.limit).to.equal(1);
			});

			it('should return an error (global + local limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [
						{ city: 'milan', limit: 1 },
					],
					measurementOptions: {},
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
						{ city: 'milan' },
						{ city: 'london' },
					],
					measurementOptions: {},
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
						{ city: 'milan' },
					],
					measurementOptions: {},
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
						measurementOptions: {
							packets: 1,
						},
					};

					const valid = globalSchema.validate(input);

					expect(valid.error).to.not.exist;
				});

				it('traceroute', () => {
					const input = {
						type: 'traceroute',
						target: 'abc.com',
						measurementOptions: {
							protocol: 'TCP',
							port: 80,
						},
					};

					const valid = globalSchema.validate(input);

					expect(valid.error).to.not.exist;
				});

				it('dns', () => {
					const input = {
						type: 'dns',
						target: 'abc.com',
						measurementOptions: {
							query: {
								type: 'A',
							},
							trace: false,
							resolver: '1.1.1.1',
							protocol: 'UDP',
							port: 53,
						},
					};

					const valid = globalSchema.validate(input);

					expect(valid.error).to.not.exist;
				});

				it('mtr', () => {
					const input = {
						type: 'mtr',
						target: 'abc.com',
						measurementOptions: {
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
						measurementOptions: {
							protocol: 'https',
							port: 443,
							request: {
								method: 'GET',
								host: 'elocast.com',
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

				expect(valid.value![0].network).to.equal(input[0]!.network.toLowerCase());
				expect(valid.value![0].network).to.not.equal(input[0]!.network);
			});

			it('should correct city value (upper case)', () => {
				const input = [
					{
						city: 'LONDON',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].city).to.equal(input[0]!.city.toLowerCase());
				expect(valid.value![0].city).to.not.equal(input[0]!.city);
			});

			it('should correct the city value (non-ASCII)', () => {
				const input = [
					{
						city: 'České Budějovice',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].city).to.not.equal(input[0]!.city);
				expect(valid.value![0].city).to.equal('ceske budejovice');
			});

			it('should correct the magic value (non-ASCII)', () => {
				const input = [
					{
						magic: 'Petaẖ Tiqva',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].magic).to.equal('petah tiqva');
			});

			it('should correct region value (non-lowercase)', () => {
				const input = [
					{
						region: 'Northern America',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].region).to.not.equal(input[0]!.region);
				expect(valid.value![0].region).to.equal('northern america');
			});

			it('should fail (wrong region)', () => {
				const input = [
					{
						region: 'Wrong Region',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.error).to.exist;
				expect(valid.error!.message).to.equal('"[0].region" must be one of [Northern Africa, Eastern Africa, Middle Africa, Southern Africa, Western Africa, Caribbean, Central America, South America, Northern America, Central Asia, Eastern Asia, South-eastern Asia, Southern Asia, Western Asia, Eastern Europe, Northern Europe, Southern Europe, Western Europe, Australia and New Zealand, Melanesia, Micronesia, Polynesia]');
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
				expect(valid.error!.message).to.equal('"[0].magic" is not allowed to be empty');
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
				expect(valid.error!.message).to.equal('"[0].magic" must be a string');
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
		it('should fail (ip type) (private ip)', () => {
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

		it('should fail (any type) (private ip)', () => {
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
	});

	describe('domain validator', () => {
		const schema = Joi.custom(joiValidateDomain());

		it('should succeed (_acme-challenge.1337.com)', () => {
			const input = '_acme-challenge.1337.com';
			const valid = schema.validate(input);

			expect(valid.value).to.equal(input);
		});

		it('should succeed (example.com)', () => {
			const input = 'example.com';
			const valid = schema.validate(input);

			expect(valid.value).to.equal(input);
		});
	});

	describe('ping', () => {
		it('should fail (private ip)', () => {
			const input = {
				type: 'ping',
				target: '192.168.0.101',
				measurementOptions: {},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Private hostnames are not allowed.');
		});

		it('should fail (ipv6)', () => {
			const input = {
				type: 'ping',
				target: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
				measurementOptions: {},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (missing values)', () => {
			const input = {
				type: 'ping',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is required');
		});

		it('should pass (target domain)', () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target domain) (_acme-challenge.abc.com)', () => {
			const input = {
				type: 'ping',
				target: '_acme-challenge.abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', () => {
			const input = {
				type: 'ping',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', () => {
			const input = {
				type: 'ping',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'ping',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (blacklisted target ip)', () => {
			const input = {
				type: 'ping',
				target: '100.0.41.228',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should pass and correct values (incorrect capitalization)', () => {
			const input = {
				type: 'PING',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('ping');
		});

		it('should pass (deep equal)', () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
				measurementOptions: {
					packets: 1,
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should populate with default values (no measurementOptions)', () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
			};

			const desiredOutput = {
				...input,
				locations: [],
				inProgressUpdates: false,
				measurementOptions: {
					packets: 3,
				},
				limit: 1,
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('traceroute', () => {
		it('should fail (missing values)', () => {
			const input = {
				type: 'traceroute',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is required');
		});

		it('should fail (ipv6)', () => {
			const input = {
				type: 'traceroute',
				target: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'traceroute',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (blacklisted target ip)', () => {
			const input = {
				type: 'traceroute',
				target: '100.0.41.228',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (invalid port)', () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
				measurementOptions: {
					port: 232322,
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.port" must be a valid port');
		});

		it('should pass (target domain)', () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target domain) (_acme-challenge.abc.com)', () => {
			const input = {
				type: 'traceroute',
				target: '_acme-challenge.abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', () => {
			const input = {
				type: 'traceroute',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', () => {
			const input = {
				type: 'traceroute',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should pass and correct values (incorrect caps)', () => {
			const input = {
				type: 'TRACEroute',
				target: 'abc.com',
				measurementOptions: {
					protocol: 'udp',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('traceroute');
			expect(valid.value.measurementOptions.protocol).to.equal('UDP');
		});

		it('should pass (deep equal)', () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
				measurementOptions: {
					protocol: 'TCP',
					port: 80,
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should populate body with default values (no measurementOptions)', () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
			};

			const desiredOutput = {
				...input,
				limit: 1,
				inProgressUpdates: false,
				locations: [],
				measurementOptions: {
					protocol: 'ICMP',
					port: 80,
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('dns', () => {
		it('should fail (missing values)', () => {
			const input = {
				type: 'dns',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is required');
		});

		it('should fail (invalid target format)', () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided target is not a valid domain name');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'dns',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (ipv6 resolver)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" does not match any of the allowed types');
		});

		it('should fail (blacklisted domain resolver)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: '00517985.widget.windsorbongvape.com',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (blacklisted ip resolver)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: '100.0.41.228',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (invalid port)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					port: 232322,
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.port" must be a valid port');
		});

		it('should pass (hostname resolver)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: 'gns1.cloudns.net',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target domain) (_acme-challenge.abc.com)', () => {
			const input = {
				type: 'dns',
				target: '_acme-challenge.abc.com',
				measurementOptions: {},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (trace enabled)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					trace: true,
					protocol: 'tcp',
					query: {
						type: 'a',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurementOptions.trace).to.equal(true);
			expect(valid.value.measurementOptions.protocol).to.equal('TCP');
			expect(valid.value.measurementOptions.query.type).to.equal('A');
		});

		it('should pass and correct values (incorrect caps)', () => {
			const input = {
				type: 'DNS',
				target: 'abc.com',
				measurementOptions: {
					protocol: 'tcp',
					query: {
						type: 'a',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurementOptions.protocol).to.equal('TCP');
			expect(valid.value.measurementOptions.query.type).to.equal('A');
		});

		it('should pass (deep equal)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					trace: false,
					resolver: '1.1.1.1',
					protocol: 'UDP',
					port: 53,
					query: {
						type: 'A',
					},
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should populate body with default values (no measurementOptions)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
				measurementOptions: {
					trace: false,
					protocol: 'UDP',
					port: 53,
					query: {
						type: 'A',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('dns ptr', () => {
		it('should fail (uses domain for target)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR');
		});

		it('should fail (uses blacklisted ip for target)', () => {
			const input = {
				type: 'dns',
				target: '100.0.41.228',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should pass (uses ip for target)', () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).not.to.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurementOptions.query.type).to.equal('PTR');
		});

		it('should pass (uses ip for target incorrect caps for type)', () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
				measurementOptions: {
					query: {
						type: 'ptr',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).not.to.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurementOptions.query.type).to.equal('PTR');
		});
	});

	describe('mtr', () => {
		it('should fail (missing values)', () => {
			const input = {
				type: 'mtr',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is required');
		});

		it('should fail (ipv6 target)', () => {
			const input = {
				type: 'mtr',
				target: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'mtr',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (blacklisted target ip)', () => {
			const input = {
				type: 'mtr',
				target: '100.0.41.228',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (invalid port)', () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
				measurementOptions: {
					port: 232322,
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.port" must be a valid port');
		});

		it('should pass (target domain)', () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target domain) (_acme-challenge.abc.com)', () => {
			const input = {
				type: 'mtr',
				target: '_acme-challenge.abc.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ip)', () => {
			const input = {
				type: 'mtr',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ip format)', () => {
			const input = {
				type: 'mtr',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should pass and correct values (incorrect caps)', () => {
			const input = {
				type: 'MtR',
				target: 'abc.com',
				measurementOptions: {
					protocol: 'udp',
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('mtr');
			expect(valid.value.measurementOptions.protocol).to.equal('UDP');
		});

		it('should pass (deep equal)', () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
				measurementOptions: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should populate body with default values (no measurementOptions)', () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
				measurementOptions: {
					protocol: 'ICMP',
					packets: 3,
					port: 80,
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('http', () => {
		it('should fail (unsupported resolver format)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					protocol: 'https',
					port: 443,
					resolver: 'abc',
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR');
		});

		it('should fail (ipv6 resolver)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					resolver: '0083:eec9:a0b9:bc22:a151:ad0e:a3d7:fd28',
					protocol: 'https',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
					},
				},
			};

			const valid = globalSchema.validate(input);
			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR');
		});

		it('should fail (blacklisted resolver)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					resolver: '100.0.41.228',
					protocol: 'https',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
					},
				},
			};

			const valid = globalSchema.validate(input);
			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (unsupported method)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					protocol: 'https',
					port: 443,
					request: {
						host: '',
						headers: {
							test: 'abc',
						},
						method: 'POST',
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.request.method" must be one of [GET, HEAD]');
		});

		it('should fail (unsupported protocol)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					port: 443,
					protocol: 'rtmp',
					request: {
						method: 'GET',
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
					},
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.protocol" must be one of [HTTP, HTTPS, HTTP2]');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'http',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should fail (blacklisted target ip)', () => {
			const input = {
				type: 'http',
				target: '100.0.41.228',
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('Provided address is blacklisted.');
		});

		it('should pass (target domain) (_sub.domain.com)', () => {
			const input = {
				type: 'http',
				target: '_sub.domani.com',
				measurementOptions: {},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (invalid port)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					port: 232322,
				},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.port" must be a valid port');
		});

		it('should pass (empty port)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					protocol: 'https',
					request: {
						method: 'GET',
						host: 'elocast.com',
						headers: {
							test: 'abc',
						},
					},
				},
			};

			const desiredOutput = {
				type: 'http',
				target: 'elocast.com',
				inProgressUpdates: false,
				measurementOptions: {
					protocol: 'HTTPS',
					request: {
						method: 'GET',
						host: 'elocast.com',
						path: '/',
						query: '',
						headers: { test: 'abc' },
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
				measurementOptions: {
					protocol: 'https',
					port: 443,
					request: {
						method: 'GET',
						host: 'elocast.com',
						headers: {
							test: 'abc',
						},
					},
				},
			};

			const desiredOutput = {
				type: 'http',
				target: 'elocast.com',
				inProgressUpdates: false,
				measurementOptions: {
					protocol: 'HTTPS',
					port: 443,
					request: {
						method: 'GET',
						host: 'elocast.com',
						path: '/',
						query: '',
						headers: { test: 'abc' },
					},
				},
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should populate body with default values (no measurementOptions)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
			};

			const desiredOutput = {
				type: 'http',
				target: 'elocast.com',
				inProgressUpdates: false,
				measurementOptions: {
					protocol: 'HTTPS',
					request: {
						method: 'HEAD',
						path: '/',
						query: '',
						headers: {},
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
