import anyAscii from 'any-ascii';
import { countries } from 'countries-list';

/*
 * The first value should be the official ISO2 country code
 * [
 *   [ ISO2, ...aliases ]
 * ]
 * */
const customAliasesList: Array<[string, ...string[]]> = [
	[ 'gb', 'uk', 'great britain', 'england', 'northern ireland', 'wales', 'scotland' ],
];

const aliasesByCountry = new Map(Object.entries(countries)
	.filter(([ , country ]) => country.alias)
	.map(([ code, country ]) => [ code.toLowerCase(), country.alias! ]));

for (const [ code, ...customAliases ] of customAliasesList) {
	aliasesByCountry.set(code, [ ...(aliasesByCountry.get(code) ?? []), ...customAliases ]);
}

export const aliases = Array.from(aliasesByCountry, ([ code, aliases ]) => [
	code,
	...new Set(aliases.map(alias => anyAscii(alias).toLowerCase())),
]);
