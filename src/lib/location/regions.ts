// Region names based on https://unstats.un.org/unsd/methodology/m49/

export const regions = {
	'Northern Africa': [ 'DZ', 'EG', 'LY', 'MA', 'SD', 'TN', 'EH' ],
	'Eastern Africa': [ 'BI', 'KM', 'DJ', 'ER', 'ET', 'KE', 'MG', 'MW', 'MU', 'MZ', 'RW', 'SC', 'SO', 'SS', 'TZ', 'UG', 'ZM', 'ZW', 'RE', 'TF', 'YT' ],
	'Middle Africa': [ 'AO', 'CM', 'CF', 'TD', 'CG', 'CD', 'GQ', 'GA', 'ST' ],
	'Southern Africa': [ 'BW', 'LS', 'NA', 'ZA', 'SZ' ],
	'Western Africa': [ 'BJ', 'BF', 'CV', 'GM', 'GH', 'GN', 'GW', 'CI', 'LR', 'ML', 'MR', 'NE', 'NG', 'SN', 'SL', 'TG', 'SH' ],

	'Caribbean': [ 'AG', 'BS', 'BB', 'CU', 'DM', 'DO', 'GD', 'HT', 'JM', 'KN', 'LC', 'VC', 'TT', 'GP', 'KY', 'MQ', 'MS', 'TC', 'AW', 'VG', 'VI', 'PR', 'AI', 'MF', 'BL', 'SX', 'CW', 'BQ' ],
	'Central America': [ 'BZ', 'CR', 'SV', 'GT', 'HN', 'MX', 'NI', 'PA' ],
	'South America': [ 'AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE', 'FK', 'GF', 'GS' ],
	'Northern America': [ 'CA', 'US', 'BM', 'GL', 'PM' ],

	'Central Asia': [ 'KZ', 'KG', 'TJ', 'TM', 'UZ' ],
	'Eastern Asia': [ 'CN', 'JP', 'KP', 'KR', 'MN', 'HK', 'TW', 'MO' ],
	'South-eastern Asia': [ 'BN', 'MM', 'KH', 'TL', 'ID', 'LA', 'MY', 'PH', 'SG', 'TH', 'VN' ],
	'Southern Asia': [ 'AF', 'BD', 'BT', 'IN', 'IR', 'MV', 'NP', 'PK', 'LK', 'IO' ],
	'Western Asia': [ 'BH', 'IQ', 'IL', 'JO', 'KW', 'LB', 'OM', 'QA', 'SA', 'SY', 'TR', 'AE', 'YE', 'AM', 'AZ', 'CY', 'GE', 'PS' ],

	'Eastern Europe': [ 'RU', 'BY', 'BG', 'CZ', 'HU', 'MD', 'PL', 'RO', 'SK', 'UA', 'XK' ],
	'Northern Europe': [ 'DK', 'EE', 'FI', 'IS', 'IE', 'LV', 'LT', 'NO', 'SE', 'GB', 'FO', 'GG', 'SJ', 'AX' ],
	'Southern Europe': [ 'AL', 'AD', 'BA', 'HR', 'GR', 'IT', 'MK', 'MT', 'ME', 'PT', 'SM', 'RS', 'SI', 'ES', 'VA', 'GI' ],
	'Western Europe': [ 'AT', 'BE', 'FR', 'DE', 'LI', 'LU', 'MC', 'NL', 'CH', 'JE', 'IM' ],

	'Australia and New Zealand': [ 'AU', 'NZ', 'NF' ],
	'Melanesia': [ 'FJ', 'PG', 'SB', 'VU', 'NC' ],
	'Micronesia': [ 'KI', 'MH', 'FM', 'NR', 'PW', 'MP', 'GU' ],
	'Polynesia': [ 'WS', 'TO', 'TV', 'CK', 'NU', 'PF', 'PN', 'TK', 'WF' ],
};

export const aliases = [
	[ 'northern africa', 'north africa' ],
	[ 'eastern africa', 'east africa' ],
	[ 'western africa', 'west africa' ],
	[ 'south america', 'southern america' ],
	[ 'eastern asia', 'east asia' ],
	[ 'south-eastern asia', 'south-east asia' ],
	[ 'southern asia', 'south asia' ],
	[ 'western asia', 'west asia' ],
	[ 'eastern europe', 'east europe' ],
	[ 'northern europe', 'north europe' ],
	[ 'southern europe', 'south europe' ],
	[ 'western europe', 'west europe' ],
];

export const regionNames = Object.keys(regions);
