import { expect } from 'chai';
import Joi from 'joi';
import { schemaErrorMessages } from '../../../../../src/measurement/schema/command-schema.js';
import {
	schema as globalSchema,
} from '../../../../../src/measurement/schema/global-schema.js';
import {
	schema as locationSchema,
} from '../../../../../src/measurement/schema/location-schema.js';
import {
	joiValidateTarget,
	joiValidateDomain,
	joiValidateDomainForDns,
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
				};

				const valid = globalSchema.validate(input, { convert: true });

				expect(valid.value.limit).to.equal(1);
			});

			it('should return an error (global + local limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [
						{ city: 'milan', limit: 1 },
					],
					limit: 1,
				};

				const valid = globalSchema.validate(input, { convert: true });

				expect(valid?.error?.details?.[0]?.message).to.equal('"locations[0].limit" is not allowed when a global limit is set');
			});

			it('should pass (2 locations - no limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [
						{ city: 'milan' },
						{ city: 'london' },
					],
				};

				const valid = globalSchema.validate(input, { convert: true });

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
				};

				const valid = globalSchema.validate(input, { convert: true });

				expect(valid.value.limit).to.equal(1);
			});

			it('should pass (valid anonymous global limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					limit: 50,
				};

				const valid = globalSchema.validate(input, { convert: true });

				expect(valid.error).to.not.exist;
			});

			it('should return an error (invalid anonymous global limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					limit: 51,
				};

				const valid = globalSchema.validate(input, { convert: true });

				expect(valid?.error?.details?.[0]?.message).to.equal('"limit" must be less than or equal to 50');
			});

			it('should return an error (invalid anonymous token global limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					limit: 51,
				};

				const valid = globalSchema.validate(input, { convert: true, context: { user: { id: null } } });

				expect(valid?.error?.details?.[0]?.message).to.equal('"limit" must be less than or equal to 50');
			});

			it('should pass (valid authenticated global limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					limit: 500,
				};

				const valid = globalSchema.validate(input, { convert: true, context: { user: { id: '1' } } });

				expect(valid.error).to.not.exist;
			});

			it('should return an error (invalid authenticated global limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					limit: 501,
				};

				const valid = globalSchema.validate(input, { convert: true, context: { user: { id: '1' } } });

				expect(valid?.error?.details?.[0]?.message).to.equal('"limit" must be less than or equal to 500');
			});

			it('should return an error (locations anonymous limit sum is bigger than global limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [{
						country: 'BR',
						limit: 20,
					}, {
						country: 'CZ',
						limit: 20,
					}, {
						country: 'DE',
						limit: 20,
					}],
				};

				const valid = globalSchema.validate(input, { convert: true });

				expect(valid?.error?.details?.[0]?.message).to.equal('the sum of limits must be less than or equal to 50');
			});

			it('should return an error (locations authenticated limit sum is bigger than global limit)', () => {
				const input = {
					type: 'ping',
					target: 'abc.com',
					locations: [{
						country: 'BR',
						limit: 200,
					}, {
						country: 'CZ',
						limit: 200,
					}, {
						country: 'DE',
						limit: 200,
					}],
				};

				const valid = globalSchema.validate(input, { convert: true, context: { user: { id: '1' } } });

				expect(valid?.error?.details?.[0]?.message).to.equal('the sum of limits must be less than or equal to 500');
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

					const valid = globalSchema.validate(input, { convert: true });

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

					const valid = globalSchema.validate(input, { convert: true });

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

					const valid = globalSchema.validate(input, { convert: true });

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

					const valid = globalSchema.validate(input, { convert: true });

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

					const valid = globalSchema.validate(input, { convert: true });

					expect(valid.error).to.not.exist;
				});
			});
		});
	});

	describe('location', () => {
		describe('input case', () => {
			it('should NOT change network name', () => {
				const input = [
					{
						network: 'VIRGIN MEDIA',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].network).to.equal(input[0]!.network);
			});

			it('should NOT change city value (upper case)', () => {
				const input = [
					{
						city: 'LONDON',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].city).to.equal(input[0]!.city);
			});

			it('should correct the city value (non-ASCII)', () => {
				const input = [
					{
						city: 'České Budějovice',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].city).to.equal('Ceske Budejovice');
			});

			it('should correct the magic value (non-ASCII)', () => {
				const input = [
					{
						magic: 'Petaẖ Tiqva',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].magic).to.equal('Petah Tiqva');
			});

			it('should correct region value (lowercase)', () => {
				const input = [
					{
						region: 'northern america',
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].region).to.not.equal(input[0]!.region);
				expect(valid.value![0].region).to.equal('Northern America');
			});

			it('should NOT change tag value (lowercase)', () => {
				const input = [
					{
						tags: [ 'DifferentCase-tag' ],
						limit: 1,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.value![0].tags).to.deep.equal(input[0]!.tags);
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

		describe('limit', () => {
			it('should pass (valid anonymous location limit)', () => {
				const input = [
					{
						city: 'Warsaw',
						limit: 50,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid.error).to.not.exist;
			});

			it('should return an error (invalid anonymous location limit)', () => {
				const input = [
					{
						city: 'Warsaw',
						limit: 201,
					},
				];

				const valid = locationSchema.validate(input);

				expect(valid?.error?.details?.[0]?.message).to.equal('"[0].limit" must be less than or equal to 50');
			});

			it('should pass (valid authenticated location limit)', () => {
				const input = [
					{
						city: 'Warsaw',
						limit: 500,
					},
				];

				const valid = locationSchema.validate(input, { context: { user: { id: '1' } } });

				expect(valid.error).to.not.exist;
			});

			it('should return an error (invalid authenticated location limit)', () => {
				const input = [
					{
						city: 'Warsaw',
						limit: 501,
					},
				];

				const valid = locationSchema.validate(input, { context: { user: { id: '1' } } });

				expect(valid?.error?.details?.[0]?.message).to.equal('"[0].limit" must be less than or equal to 500');
			});
		});
	});

	describe('target validator', () => {
		it('should fail (ip type) (private ipv4)', () => {
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

		it('should fail (ip type) (private ipv6)', () => {
			const input = '64:ff9b:1::1a2b:3c4d';

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

		it('should fail (any type) (private ipv4)', () => {
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

		it('should fail (any type) (private ipv6)', () => {
			const input = 'fe80::ffff:ffff:ffff:ffff';

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
		const schema = Joi.custom(joiValidateDomain()).messages(schemaErrorMessages);

		it('should succeed (_acme-challenge.1337.com)', () => {
			const input = '_acme-challenge.1337.com';
			const valid = schema.validate(input);

			expect(valid.value).to.equal(input);
			expect(valid.error).to.not.exist;
		});

		it('should succeed (example.com)', () => {
			const input = 'example.com';
			const valid = schema.validate(input);

			expect(valid.value).to.equal(input);
			expect(valid.error).to.not.exist;
		});

		it('should fail (root domain)', () => {
			const input = '.';
			const valid = schema.validate(input);

			expect(valid.error!.details[0]!.message).to.equal('"value" must be a valid domain name');
		});

		it('should fail (tld)', () => {
			const input = 'com';
			const valid = schema.validate(input);

			expect(valid.error!.details[0]!.message).to.equal('"value" must be a valid domain name');
		});

		it('should fail (trailing dot)', () => {
			const input = 'example.com.';
			const valid = schema.validate(input);

			expect(valid.error!.details[0]!.message).to.equal('"value" must be a valid domain name');
		});
	});

	describe('dns domain validator', () => {
		const schema = Joi.custom(joiValidateDomainForDns()).messages(schemaErrorMessages);

		it('should succeed (_acme-challenge.1337.com)', () => {
			const input = '_acme-challenge.1337.com';
			const valid = schema.validate(input);

			expect(valid.value).to.equal(input);
			expect(valid.error).to.not.exist;
		});

		it('should succeed (example.com)', () => {
			const input = 'example.com';
			const valid = schema.validate(input);

			expect(valid.value).to.equal(input);
			expect(valid.error).to.not.exist;
		});

		it('should succeed (root domain)', () => {
			const input = '.';
			const valid = schema.validate(input);

			expect(valid.value).to.equal(input);
			expect(valid.error).to.not.exist;
		});

		it('should succeed (tld)', () => {
			const input = 'com';
			const valid = schema.validate(input);

			expect(valid.value).to.equal('com');
			expect(valid.error).to.not.exist;
		});

		it('should succeed (trailing dot)', () => {
			const input = 'example.com.';
			const valid = schema.validate(input);

			expect(valid.value).to.equal('example.com.');
			expect(valid.error).to.not.exist;
		});
	});

	describe('ping', () => {
		it('should fail (private ipv4)', () => {
			const input = {
				type: 'ping',
				target: '192.168.0.101',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" must not be a private hostname');
		});

		it('should fail (private ipv6)', () => {
			const input = {
				type: 'ping',
				target: 'fe80::ffff:ffff:ffff:ffff',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" must not be a private hostname');
		});

		it('should fail (missing values)', () => {
			const input = {
				type: 'ping',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is required');
		});

		it('should fail (brackets-only target)', () => {
			const input = {
				type: 'ping',
				target: '[]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should pass (target domain)', () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (target domain) (_acme-challenge.abc.com)', () => {
			const input = {
				type: 'ping',
				target: '_acme-challenge.abc.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ipv4)', () => {
			const input = {
				type: 'ping',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should fail (target bracketed domain)', () => {
			const input = {
				type: 'ping',
				target: '[abc.com]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should pass (target ipv6)', () => {
			const input = {
				type: 'ping',
				target: '2001:41f0:4060::',
				measurementOptions: {},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should pass (target bracketed ipv6)', () => {
			const input = {
				type: 'ping',
				target: '[2a04:4e42:f000::485]',
				measurementOptions: {},
			};

			const valid = globalSchema.validate(input);

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ipv4 format)', () => {
			const input = {
				type: 'ping',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target: invalid ipv6 format)', () => {
			const input = {
				type: 'ping',
				target: '2a06:e80:::3000:abcd:1234:5678:9abc:def0',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target: invalid bracketed ipv6 format)', () => {
			const input = {
				type: 'ping',
				target: '[2a06:e80:::3000:abcd:1234:5678:9abc:def0]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target: partially bracketed valid ipv6 format)', () => {
			const input = {
				type: 'ping',
				target: '2001:41f0:4060::]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target: valid but bracketed ipv4 address)', () => {
			const input = {
				type: 'ping',
				target: '[8.8.8.8]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'ping',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted target ipv4)', () => {
			const input = {
				type: 'ping',
				target: '100.0.41.228',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted target ipv6)', () => {
			const input = {
				type: 'ping',
				target: '2803:5380:ffff::386',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted bracketed target ipv6)', () => {
			const input = {
				type: 'ping',
				target: '[2803:5380:ffff::386]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (unsupported ipVersion)', () => {
			const input = {
				type: 'ping',
				target: '_acme-challenge.abc.com',
				measurementOptions: {
					ipVersion: 8,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" must be either 4 or 6');
		});

		it('should pass and correct values (incorrect capitalization)', () => {
			const input = {
				type: 'PING',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('ping');
		});

		it('should pass (deep equal)', () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
				measurementOptions: {
					packets: 1,
					protocol: 'ICMP',
					port: 80,
					ipVersion: 4,
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

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
					protocol: 'ICMP',
					port: 80,
					ipVersion: 4,
				},
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 target is a domain', () => {
			const input = {
				type: 'ping',
				target: 'abc.com',
				measurementOptions: {
					packets: 1,
					protocol: 'ICMP',
					port: 80,
					ipVersion: 6,
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should fail ip version provided when target is an ip', () => {
			const input = {
				type: 'ping',
				target: '1.1.1.1',
				measurementOptions: {
					packets: 1,
					protocol: 'ICMP',
					port: 80,
					ipVersion: 4,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" is not allowed when target is not a domain');
		});

		it('should pass (deep equal) ip version 4 automatically selected when target ipv4', () => {
			const input = {
				type: 'ping',
				target: '1.1.1.1',
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				locations: [],
				limit: 1,
				measurementOptions: {
					packets: 3,
					protocol: 'ICMP',
					port: 80,
					ipVersion: 4,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 automatically selected when target ipv6', () => {
			const input = {
				type: 'ping',
				target: '2001:41f0:4060::',
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				locations: [],
				limit: 1,
				measurementOptions: {
					packets: 3,
					protocol: 'ICMP',
					port: 80,
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 automatically selected when target is bracketed ipv6', () => {
			const input = {
				type: 'ping',
				target: '[2001:41f0:4060::]',
			};

			const desiredOutput = {
				type: 'ping',
				target: '2001:41f0:4060::',
				inProgressUpdates: false,
				locations: [],
				limit: 1,
				measurementOptions: {
					packets: 3,
					protocol: 'ICMP',
					port: 80,
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('traceroute', () => {
		it('should fail (missing values)', () => {
			const input = {
				type: 'traceroute',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is required');
		});

		it('should fail (brackets-only target)', () => {
			const input = {
				type: 'traceroute',
				target: '[]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'traceroute',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted target ipv4)', () => {
			const input = {
				type: 'traceroute',
				target: '100.0.41.228',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted target ipv6)', () => {
			const input = {
				type: 'traceroute',
				target: '2803:5380:ffff::386',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted bracketed target ipv6)', () => {
			const input = {
				type: 'traceroute',
				target: '[2803:5380:ffff::386]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (invalid port)', () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
				measurementOptions: {
					port: 232322,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.port" must be a valid port');
		});

		it('should fail (unsupported ipVersion)', () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
				measurementOptions: {
					ipVersion: 8,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" must be either 4 or 6');
		});

		it('should pass (target domain)', () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should fail (target bracketed domain)', () => {
			const input = {
				type: 'traceroute',
				target: '[abc.com]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should pass (target domain) (_acme-challenge.abc.com)', () => {
			const input = {
				type: 'traceroute',
				target: '_acme-challenge.abc.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ipv4)', () => {
			const input = {
				type: 'traceroute',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ipv6)', () => {
			const input = {
				type: 'traceroute',
				target: '2001:41f0:4060::',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (target bracketed ipv6)', () => {
			const input = {
				type: 'traceroute',
				target: '[2a04:4e42:f000::485]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ipv4 format)', () => {
			const input = {
				type: 'traceroute',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target: valid but bracketed ipv4 address)', () => {
			const input = {
				type: 'traceroute',
				target: '[1.1.1.1]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target: invalid ipv6 format)', () => {
			const input = {
				type: 'traceroute',
				target: '2a06:e80:::3000:abcd:1234:5678:9abc:def0',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target: invalid bracketed ipv6 format)', () => {
			const input = {
				type: 'traceroute',
				target: '[2a06:e80:::3000:abcd:1234:5678:9abc:def0]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target: partially bracketed valid ipv6 format)', () => {
			const input = {
				type: 'traceroute',
				target: '2001:41f0:4060::]',
			};

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('traceroute');
			expect(valid.value.measurementOptions.protocol).to.equal('UDP');
		});

		it('should pass (deep equal) ip version 6 target is a domain', () => {
			const input = {
				type: 'traceroute',
				target: 'abc.com',
				measurementOptions: {
					protocol: 'TCP',
					port: 80,
					ipVersion: 6,
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

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
					ipVersion: 4,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should fail ip version provided when target is an ip', () => {
			const input = {
				type: 'traceroute',
				target: '2001:41f0:4060::',
				measurementOptions: {
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" is not allowed when target is not a domain');
		});

		it('should fail ip version provided when target is a bracketed ip', () => {
			const input = {
				type: 'traceroute',
				target: '[2001:41f0:4060::]',
				measurementOptions: {
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" is not allowed when target is not a domain');
		});

		it('should pass (deep equal) ip version 4 automatically selected when target ipv4', () => {
			const input = {
				type: 'traceroute',
				target: '1.1.1.1',
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
				measurementOptions: {
					protocol: 'ICMP',
					port: 80,
					ipVersion: 4,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 automatically selected when target ipv6', () => {
			const input = {
				type: 'traceroute',
				target: '2001:41f0:4060::',
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
				measurementOptions: {
					protocol: 'ICMP',
					port: 80,
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 automatically selected when target bracketed ipv6', () => {
			const input = {
				type: 'traceroute',
				target: '[2001:41f0:4060::]',
			};

			const desiredOutput = {
				type: 'traceroute',
				target: '2001:41f0:4060::',
				inProgressUpdates: false,
				limit: 1,
				locations: [],
				measurementOptions: {
					protocol: 'ICMP',
					port: 80,
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	describe('dns', () => {
		it('should fail (missing values)', () => {
			const input = {
				type: 'dns',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is required');
		});

		it('should fail (invalid target format)', () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" must be a valid domain name');
		});

		it('should fail (invalid target format)', () => {
			const input = {
				type: 'dns',
				target: '[2a04:4e42:f000::485]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" must be a valid domain name');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'dns',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted domain');
		});

		it('should pass (ipv6 resolver)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: '2001:41f0:4060::',
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should fail (bracketed ipv6 resolver)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: '[2001:41f0:4060::]',
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" is a blacklisted address or domain');
		});

		it('should fail (blacklisted ipv4 resolver)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: '100.0.41.228',
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" is a blacklisted address or domain');
		});

		it('should fail (blacklisted ipv6 resolver)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: '2803:5380:ffff::386',
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" is a blacklisted address or domain');
		});

		it('should fail (invalid port)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					port: 232322,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should fail (unsupported ipVersion)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: 'gns1.cloudns.net',
					ipVersion: 8,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" must be either 4 or 6');
		});

		it('should pass (target domain) (_acme-challenge.abc.com)', () => {
			const input = {
				type: 'dns',
				target: '_acme-challenge.abc.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

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
					ipVersion: 4,
				},
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 resolver is a domain', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					trace: false,
					resolver: 'gns1.cloudns.net',
					protocol: 'UDP',
					port: 53,
					query: {
						type: 'A',
					},
					ipVersion: 6,
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 4 automatically selected when resolver is ipv4', () => {
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
					ipVersion: 4,
				},
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 automatically selected when resolver is ipv6', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					trace: false,
					resolver: '2001:41f0:4060::',
					protocol: 'UDP',
					port: 53,
					query: {
						type: 'A',
					},
				},
			};

			const desiredOutput = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					trace: false,
					resolver: '2001:41f0:4060::',
					protocol: 'UDP',
					port: 53,
					query: {
						type: 'A',
					},
					ipVersion: 6,
				},
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

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
					ipVersion: 4,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should fail (ip version provided when resolver is an ip)', () => {
			const input = {
				type: 'dns',
				target: 'abc.com',
				measurementOptions: {
					resolver: '2001:41f0:4060::',
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" is not allowed when resolver is not a domain');
		});

		it('should pass (root domain)', () => {
			const input = {
				type: 'dns',
				target: '.',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (tld)', () => {
			const input = {
				type: 'dns',
				target: 'com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (trailing dot)', () => {
			const input = {
				type: 'dns',
				target: 'example.com.',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" must be a valid ipv4 or ipv6 address');
		});

		it('should fail (uses blacklisted ipv4 for target)', () => {
			const input = {
				type: 'dns',
				target: '100.0.41.228',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address');
		});

		it('should fail (uses blacklisted ipv6 for target)', () => {
			const input = {
				type: 'dns',
				target: '2803:5380:ffff::386',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address');
		});

		it('should fail (uses blacklisted bracketed ipv6 for target)', () => {
			const input = {
				type: 'dns',
				target: '[2803:5380:ffff::386]',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address');
		});

		it('should pass (uses ipv4 for target)', () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).not.to.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurementOptions.query.type).to.equal('PTR');
		});

		it('should pass (uses ipv6 for target)', () => {
			const input = {
				type: 'dns',
				target: '2001:41f0:4060::',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).not.to.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurementOptions.query.type).to.equal('PTR');
		});

		it('should pass (uses bracketed ipv6 for target)', () => {
			const input = {
				type: 'dns',
				target: '[2001:41f0:4060::]',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).not.to.exist;
			expect(valid.value.type).to.equal('dns');
			expect(valid.value.measurementOptions.query.type).to.equal('PTR');
		});

		it('should fail (uses bracketed ipv4 for target)', () => {
			const input = {
				type: 'dns',
				target: '[8.8.8.8]',
				measurementOptions: {
					query: {
						type: 'PTR',
					},
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" must be a valid ip address of one of the following versions [ipv4, ipv6] with a forbidden CIDR');
		});

		it('should pass (uses ipv4 for target incorrect caps for type)', () => {
			const input = {
				type: 'dns',
				target: '1.1.1.1',
				measurementOptions: {
					query: {
						type: 'ptr',
					},
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is required');
		});

		it('should fail (brackets-only target)', () => {
			const input = {
				type: 'mtr',
				target: '[]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should pass (ipv6 target)', () => {
			const input = {
				type: 'mtr',
				target: '2001:41f0:4060::',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (bracketed ipv6 target)', () => {
			const input = {
				type: 'mtr',
				target: '[2001:41f0:4060::]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'mtr',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted target ipv4)', () => {
			const input = {
				type: 'mtr',
				target: '100.0.41.228',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted target ipv6)', () => {
			const input = {
				type: 'mtr',
				target: '2803:5380:ffff::386',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted bracketed target ipv6)', () => {
			const input = {
				type: 'mtr',
				target: '[2803:5380:ffff::386]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (invalid port)', () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
				measurementOptions: {
					port: 232322,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.port" must be a valid port');
		});

		it('should fail (unsupported ipVersion)', () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
				measurementOptions: {
					ipVersion: 8,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" must be either 4 or 6');
		});

		it('should pass (target domain)', () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should fail (target bracketed domain)', () => {
			const input = {
				type: 'mtr',
				target: '[abc.com]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should pass (target domain) (_acme-challenge.abc.com)', () => {
			const input = {
				type: 'mtr',
				target: '_acme-challenge.abc.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should pass (target ipv4)', () => {
			const input = {
				type: 'mtr',
				target: '1.1.1.1',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
		});

		it('should fail (target: invalid ipv4 format)', () => {
			const input = {
				type: 'mtr',
				target: '300.300.300.300',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});

		it('should fail (target valid but bracketed ipv4)', () => {
			const input = {
				type: 'mtr',
				target: '[1.1.1.1]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" does not match any of the allowed types');
		});


		it('should fail (target: invalid ipv6 format)', () => {
			const input = {
				type: 'mtr',
				target: '2a06:e80:::3000:abcd:1234:5678:9abc:def0',
			};

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value.type).to.equal('mtr');
			expect(valid.value.measurementOptions.protocol).to.equal('UDP');
		});

		it('should fail ip version provided when target is an ip', () => {
			const input = {
				type: 'mtr',
				target: '2001:41f0:4060::',
				measurementOptions: {
					protocol: 'udp',
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" is not allowed when target is not a domain');
		});

		it('should fail ip version provided when target is a bracketed ip', () => {
			const input = {
				type: 'mtr',
				target: '[2001:41f0:4060::]',
				measurementOptions: {
					protocol: 'udp',
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" is not allowed when target is not a domain');
		});

		it('should pass (deep equal) ip version 4 automatically selected when target ipv4', () => {
			const input = {
				type: 'mtr',
				target: '1.1.1.1',
				measurementOptions: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
				},
			};

			const desiredOutput = {
				type: 'mtr',
				target: '1.1.1.1',
				measurementOptions: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
					ipVersion: 4,
				},
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 automatically selected when target ipv6', () => {
			const input = {
				type: 'mtr',
				target: '2001:41f0:4060::',
				measurementOptions: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
				},
			};

			const desiredOutput = {
				type: 'mtr',
				target: '2001:41f0:4060::',
				measurementOptions: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
					ipVersion: 6,
				},
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 automatically selected when target bracketed ipv6', () => {
			const input = {
				type: 'mtr',
				target: '[2001:41f0:4060::]',
				measurementOptions: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
				},
			};

			const desiredOutput = {
				type: 'mtr',
				target: '2001:41f0:4060::',
				measurementOptions: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
					ipVersion: 6,
				},
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 domain', () => {
			const input = {
				type: 'mtr',
				target: 'abc.com',
				measurementOptions: {
					protocol: 'TCP',
					packets: 10,
					port: 80,
					ipVersion: 6,
				},
			};

			const desiredOutput = {
				...input,
				inProgressUpdates: false,
				limit: 1,
				locations: [],
			};

			const valid = globalSchema.validate(input, { convert: true });

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
					ipVersion: 4,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" must be a valid ip address of one of the following versions [ipv4, ipv6] with a forbidden CIDR');
		});

		it('should pass (ipv6 resolver)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					resolver: '2001:41f0:4060::',
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

			const valid = globalSchema.validate(input, { convert: true });
			expect(valid.error).to.not.exist;
		});

		it('should fail (bracketed ipv6 resolver)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					resolver: '[2001:41f0:4060::]',
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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" must be a valid ip address of one of the following versions [ipv4, ipv6] with a forbidden CIDR');
		});

		it('should fail (blacklisted ipv4 resolver)', () => {
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

			const valid = globalSchema.validate(input, { convert: true });
			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" is a blacklisted address');
		});

		it('should fail (blacklisted ipv6 resolver)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					resolver: '2803:5380:ffff::386',
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

			const valid = globalSchema.validate(input, { convert: true });
			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.resolver" is a blacklisted address');
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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.request.method" must be one of [GET, HEAD, OPTIONS]');
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

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.protocol" must be one of [HTTP, HTTPS, HTTP2]');
		});

		it('should fail (unsupported ipVersion)', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					resolver: '2001:41f0:4060::',
					protocol: 'https',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
					},
					ipVersion: 8,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" must be either 4 or 6');
		});

		it('should fail (blacklisted target domain)', () => {
			const input = {
				type: 'http',
				target: '00517985.widget.windsorbongvape.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted target ipv4)', () => {
			const input = {
				type: 'http',
				target: '100.0.41.228',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted target ipv6)', () => {
			const input = {
				type: 'http',
				target: '2803:5380:ffff::386',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should fail (blacklisted bracketed target ipv6)', () => {
			const input = {
				type: 'http',
				target: '[2803:5380:ffff::386]',
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"target" is a blacklisted address or domain');
		});

		it('should pass (target domain) (_sub.domain.com)', () => {
			const input = {
				type: 'http',
				target: '_sub.domani.com',
			};

			const valid = globalSchema.validate(input, { convert: true });

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

			const valid = globalSchema.validate(input, { convert: true });

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
					ipVersion: 4,
				},
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

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
					ipVersion: 4,
				},
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

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
					ipVersion: 4,
				},
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 target is a domain', () => {
			const input = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					resolver: '1.1.1.1',
					protocol: 'https',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
					},
					ipVersion: 6,
				},
			};

			const desiredOutput = {
				type: 'http',
				target: 'elocast.com',
				measurementOptions: {
					resolver: '1.1.1.1',
					protocol: 'HTTPS',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
						query: '',
						path: '/',
					},
					ipVersion: 6,
				},
				inProgressUpdates: false,
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should fail ip version provided when target is an ip', () => {
			const input = {
				type: 'http',
				target: '2001:41f0:4060::',
				measurementOptions: {
					resolver: '2001:41f0:4060::',
					protocol: 'https',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
					},
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });
			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" is not allowed when target is not a domain');
		});

		it('should fail ip version provided when target is a bracketed ip', () => {
			const input = {
				type: 'http',
				target: '[2001:41f0:4060::]',
				measurementOptions: {
					resolver: '2001:41f0:4060::',
					protocol: 'https',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
					},
					ipVersion: 6,
				},
			};

			const valid = globalSchema.validate(input, { convert: true });
			expect(valid.error).to.exist;
			expect(valid.error!.message).to.equal('"measurementOptions.ipVersion" is not allowed when target is not a domain');
		});

		it('should pass (deep equal) ip version 4 automatically selected when target is ipv4', () => {
			const input = {
				type: 'http',
				target: '1.1.1.1',
				measurementOptions: {
					resolver: '1.2.3.4',
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

			const desiredOutput = {
				type: 'http',
				target: '1.1.1.1',
				measurementOptions: {
					resolver: '1.2.3.4',
					protocol: 'HTTPS',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
						query: '',
						path: '/',
					},
					ipVersion: 4,
				},
				inProgressUpdates: false,
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});

		it('should pass (deep equal) ip version 6 automatically selected when target is ipv6', () => {
			const input = {
				type: 'http',
				target: '2001:41f0:4060::',
				measurementOptions: {
					resolver: '1.1.1.1',
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

			const desiredOutput = {
				type: 'http',
				target: '2001:41f0:4060::',
				measurementOptions: {
					resolver: '1.1.1.1',
					protocol: 'HTTPS',
					port: 443,
					request: {
						host: 'abc.com',
						headers: {
							test: 'abc',
						},
						method: 'GET',
						query: '',
						path: '/',
					},
					ipVersion: 6,
				},
				inProgressUpdates: false,
				locations: [],
				limit: 1,
			};

			const valid = globalSchema.validate(input, { convert: true });

			expect(valid.error).to.not.exist;
			expect(valid.value).to.deep.equal(desiredOutput);
		});
	});

	it('should pass (deep equal) ip version 6 automatically selected when target is bracketed ipv6', () => {
		const input = {
			type: 'http',
			target: '[2001:41f0:4060::]',
			measurementOptions: {
				resolver: '1.1.1.1',
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

		const desiredOutput = {
			type: 'http',
			target: '2001:41f0:4060::',
			measurementOptions: {
				resolver: '1.1.1.1',
				protocol: 'HTTPS',
				port: 443,
				request: {
					host: 'abc.com',
					headers: {
						test: 'abc',
					},
					method: 'GET',
					query: '',
					path: '/',
				},
				ipVersion: 6,
			},
			inProgressUpdates: false,
			locations: [],
			limit: 1,
		};

		const valid = globalSchema.validate(input, { convert: true });

		expect(valid.error).to.not.exist;
		expect(valid.value).to.deep.equal(desiredOutput);
	});
});
