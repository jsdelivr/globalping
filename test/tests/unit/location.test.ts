import { expect } from 'chai';
import { getIndex, getRegionByCountry } from '../../../src/lib/location/location.js';
import type { ProbeLocation, Tag } from '../../../src/probe/types.js';

describe('location index', () => {
	it('normalizes country names and includes backwards-compatible aliases', () => {
		const location: ProbeLocation = {
			continent: 'AS',
			region: getRegionByCountry('TR'),
			country: 'TR',
			state: null,
			city: 'Istanbul',
			normalizedCity: 'istanbul',
			asn: 9121,
			latitude: 41.0082,
			longitude: 28.9784,
			network: 'Turk Telekom',
			normalizedNetwork: 'turk telekom',
			allowedCountries: [],
		};

		const index = getIndex(location, []);

		expect(index[2]).to.deep.equal([ 'turkiye' ]);
		expect(index[3]).to.deep.equal([ 'tr', 'turkey' ]);
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
