import { expect } from 'chai';
import { getIndex, getRegionByCountry } from '../../../src/lib/location/location.js';
import type { ProbeLocation, Tag } from '../../../src/probe/types.js';

describe('location index', () => {
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
