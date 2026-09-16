import { expect } from 'chai';
import { countries } from 'countries-list';
import { getCountryAliases, getIndex, getRegionByCountry } from '../../../src/lib/location/location.js';
import { regions } from '../../../src/lib/location/regions.js';
import type { ProbeLocation, Tag } from '../../../src/probe/types.js';

describe('location index', () => {
	it('maps every ISO 3166-1 country to a region', () => {
		const nonIso3166CountryCodes = new Set([ 'AC', 'TA', 'XK' ]);
		const iso3166CountryCodes = Object.keys(countries).filter(code => !nonIso3166CountryCodes.has(code));
		const mappedCountryCodes = new Set(Object.values(regions).flat());

		expect(iso3166CountryCodes.filter(code => !mappedCountryCodes.has(code))).to.deep.equal([]);
	});

	it('merges package and Globalping country aliases', () => {
		expect(getCountryAliases('MM')).to.include.members([ 'mm', 'burma', 'myanmar (burma)' ]);
		expect(getCountryAliases('GB')).to.include.members([ 'gb', 'uk', 'britain', 'great britain', 'england', 'scotland' ]);
	});

	it('normalizes package country aliases for location matching', () => {
		expect(getCountryAliases('CZ')).to.include.members([ 'czech republic', 'ceska republika' ]);
	});

	it('adds prefixes for system tags except user-prefixed tags', () => {
		const location: ProbeLocation = {
			continent: 'EU',
			region: getRegionByCountry('GB'),
			country: 'GB',
			state: null,
			city: 'London',
			normalizedCity: 'london',
			asn: 5089,
			latitude: 51.5072,
			longitude: -0.1276,
			network: 'Virgin Media',
			normalizedNetwork: 'virgin media',
			allowedCountries: [],
		};
		const tags: Tag[] = [
			{ type: 'system', value: 'datacenter-network' },
			{ type: 'system', subtype: 'cloud', value: 'aws-ap-northeast-2' },
			{ type: 'system', value: 'u-jsdelivr' },
			{ type: 'system', value: 'u:jsdelivr' },
			{ type: 'user', value: 'u-jsdelivr:custom-tag' },
		];

		const index = getIndex(location, tags);

		expect(index[13]).to.deep.equal([
			'datacenter network',
			'datacenter',
			'aws ap northeast 2',
			'aws ap northeast',
			'aws ap',
			'aws',
			'u jsdelivr',
			'u:jsdelivr',
		]);
	});
});
