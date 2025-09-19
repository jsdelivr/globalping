import { expect } from 'chai';
import { populateLegalNames } from '../../../../src/lib/geoip/legal-name-normalization.js';
import { normalizeNetworkNamePublic } from '../../../../src/lib/geoip/utils.js';

describe('network-name-normalization', () => {
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
		{ original: 'LEASEWEB SINGAPORE PTE. LTD.', expected: 'LEASEWEB' },
		{ original: 'Kuroit Limited', expected: 'Kuroit' },
		{ original: 'O2 Czech Republic, a.s.', expected: 'O2' },
		{ original: 'Telefonica Germany GmbH & Co.OHG', expected: 'Telefonica' },
		{ original: 'FASTER CZ spol. s r.o.', expected: 'FASTER CZ' },
		{ original: 'Orange Polska Spolka Akcyjna', expected: 'Orange' },

		// prefix and quotes
		{ original: 'JSC "ER-Telecom Holding"', expected: 'ER-Telecom Holding' },

		// "trading as"
		{ original: 'Matteo Martelloni trading as DELUXHOST', expected: 'DELUXHOST' },

		// non-ascii
		{ original: 'TELEFÔNICA BRASIL', expected: 'TELEFONICA' },

		// Already normalized or no legal suffix
		{ original: 'AkileCloud Network', expected: 'AkileCloud Network' },

		// Additional cases
		{ original: 'Hangzhou Alibaba Advertising Co.,Ltd.', expected: 'Hangzhou Alibaba Advertising' },
		{ original: 'Shanghai Mobile Communications Co.,Ltd.', expected: 'Shanghai Mobile Communications' },
		{ original: 'Alibaba (US) Technology Co., Ltd.', expected: 'Alibaba (US) Technology' },
		{ original: 'Siamdata Communication Co.,Ltd.', expected: 'Siamdata Communication' },
		{ original: 'China Mobile Communications Group Co., Ltd.', expected: 'China Mobile Communications Group' },
		{ original: 'Rackzar  (Pty) Ltd', expected: 'Rackzar' },
		{ original: 'Henan Mobile Communications Co. Ltd', expected: 'Henan Mobile Communications' },
		{ original: 'Web Squad Connect (Pty) Ltd', expected: 'Web Squad Connect' },
		{ original: 'Web Dadeh Paydar Co (Ltd)', expected: 'Web Dadeh Paydar' },
		{ original: 'Jinx Co. Limited', expected: 'Jinx' },

		{ original: 'DA International Group Ltd.', expected: 'DA International Group' },
		{ original: 'OKB PROGRESS LLC', expected: 'OKB PROGRESS' },
		{ original: 'Limited Company Information and Consulting Agency', expected: 'Limited Company Information and Consulting Agency' },
		{ original: 'IP Vendetta Inc.', expected: 'IP Vendetta' },
		{ original: 'IP ServerOne Solutions Sdn Bhd', expected: 'IP ServerOne Solutions' },
		{ original: 'PT. Elektrindo Data Nusantara', expected: 'Elektrindo Data Nusantara' },

		{ original: 'Microchip s.c. W. Wrodarczyk, A. Kossowski', expected: 'Microchip s.c. W. Wrodarczyk, A. Kossowski' },
		{ original: 'Tencent Building, Kejizhongyi Avenue', expected: 'Tencent Building, Kejizhongyi Avenue' },
		{ original: 'Hollander & Jacobsen Ug (Haftungsbeschraenkt)', expected: 'Hollander & Jacobsen' },
		{ original: 'eServer s.r.o.', expected: 'eServer' },
		{ original: 'synlinq.de', expected: 'synlinq.de' },
		{ original: 'ServerPoint.com', expected: 'ServerPoint.com' },
		{ original: 'S.C. INFOTECH-GRUP S.R.L.', expected: 'S.C. INFOTECH-GRUP' },
		{ original: 'S.SETEVAYA SVYAZ, OOO', expected: 'S.SETEVAYA SVYAZ' },
		{ original: 'TELECOMUNICACOES ALARCAO E FERNANDES LTDA - ME', expected: 'TELECOMUNICACOES ALARCAO E FERNANDES' },
		{ original: 'M & R NETWORK LTDA-ME', expected: 'M & R NETWORK' },
		{ original: 'BEIJING CBD TELECOM CO .LTD', expected: 'BEIJING CBD TELECOM' },
		{ original: 'CENTRALES ELECTRICAS DE NARIÑO S.A. E.S.P', expected: 'CENTRALES ELECTRICAS DE NARINO' },
		{ original: 'Orange Bank LLC', expected: 'Orange Bank' },
		{ original: 'ACS', expected: 'ACS' },

		{ original: 'Bank of America', expected: 'Bank of America' },
	];

	for (const { original, expected } of cases) {
		it(`normalizes "${original}" -> "${expected}"`, () => {
			const result = normalizeNetworkNamePublic(original);
			expect(result).to.equal(expected);
		});
	}
});
