import { expect } from 'chai';
import { populateLegalNames, normalizeLegalName } from '../../../../src/lib/geoip/legal-name-normalization.js';

describe('legal-name-normalization', () => {
	before(async () => {
		await populateLegalNames();
	});

	const cases: Array<{ original: string; expected: string }> = [
		{ original: 'The Constant Company, LLC', expected: 'The Constant Company' },
		{ original: 'Vodafone GmbH', expected: 'Vodafone' },
		{ original: 'OVH SAS', expected: 'OVH' },
		{ original: 'KPN B.V.', expected: 'KPN' },
		{ original: 'Vodafone Libertel B.V.', expected: 'Vodafone Libertel' },
		{ original: 'SCALEWAY S.A.S.', expected: 'SCALEWAY' },
		{ original: 'LEASEWEB SINGAPORE PTE. LTD.', expected: 'LEASEWEB SINGAPORE' },
		{ original: 'Kuroit Limited', expected: 'Kuroit' },
		{ original: 'O2 Czech Republic, a.s.', expected: 'O2 Czech Republic' },
		{ original: 'Telefonica Germany GmbH & Co.OHG', expected: 'Telefonica Germany' },
		{ original: 'FASTER CZ spol. s r.o.', expected: 'FASTER CZ' },
		{ original: 'Orange Polska Spolka Akcyjna', expected: 'Orange Polska' },

		// prefix and quotes
		{ original: 'JSC "ER-Telecom Holding"', expected: 'ER-Telecom Holding' },

		// "trading as"
		{ original: 'Matteo Martelloni trading as DELUXHOST', expected: 'DELUXHOST' },

		// Already normalized or no legal suffix
		{ original: 'AkileCloud Network', expected: 'AkileCloud Network' },
	];

	for (const { original, expected } of cases) {
		it(`normalizes "${original}" -> "${expected}"`, () => {
			const result = normalizeLegalName(original);
			expect(result).to.equal(expected);
		});
	}
});
