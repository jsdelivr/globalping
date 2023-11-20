import type { ProbeLocation } from '../../probe/types.js';

export const fakeLookup = (): ProbeLocation => {
	return {
		continent: 'SA',
		country: 'AR',
		state: undefined,
		city: 'Buenos Aires',
		region: 'South America',
		normalizedCity: 'buenos aires',
		asn: 61003,
		latitude: -34.6131,
		longitude: -58.3772,
		network: 'InterBS S.R.L. (BAEHOST)',
		normalizedNetwork: 'interbs s.r.l. (baehost)',
	};
};
