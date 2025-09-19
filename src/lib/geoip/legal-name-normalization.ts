import fs from 'node:fs';
import ascii from 'any-ascii';
import csvParser from 'csv-parser';
import { LRUCache } from 'lru-cache';
import transliterate from '@sindresorhus/transliterate';
import is from '@sindresorhus/is';

// See https://github.com/jsdelivr/globalping/issues/383
// The CSV file is from https://www.gleif.org/en/lei-data/code-lists/iso-20275-entity-legal-forms-code-list
const LEGAL_FORMS_FILENAME = '2023-09-28-elf-code-list-v1.5.csv';

const ADDITIONAL_LEGAL_FORMS = [
	{ name: 'Joint Limited Liability Company', abbr: [ 'JLLC' ] }, // Belarus
	{ name: 'Private Joint Stock', abbr: [ 'PJS' ] }, // Iran
	{ name: 'Limitada', abbr: [ 'LDA' ] }, // Portugal
	{ name: 'Unipessoal Limitada', abbr: [ 'Unipessoal LDA' ] }, // Portugal
	{ name: 'Joint Stock Company', abbr: [ 'JSC' ] }, // Russia
	{ name: 'Public Company Limited', abbr: [ 'PCL' ] }, // Thailand
	{ name: 'Liability Company', abbr: [ 'LC' ] }, // Vietnam
	{ name: 'Spolecnost s Rucenim Omezenym', abbr: [ 'SRO' ] }, // Slovakia
];

// Some languages have custom transliteration rules.
const CUSTOM_TRANSLITERATIONS = [ 'da', 'de', 'hu', 'nb', 'sr', 'sv', 'tr' ];

// Countries that sometimes write the legal form as a prefix instead of a suffix.
// We don't allow this for all countries to reduce false-positive matches.
const PREFIX_USING_COUNTRIES = [ 'RO', 'LV', 'LT', 'EE', 'RU', 'UA', 'BY', 'MD', 'GE', 'AM', 'AZ', 'KZ', 'KG', 'UZ', 'TJ', 'TM', 'FI', 'FO', 'JP', 'KR', 'TW', 'VN', 'TH', 'ID', 'IR', 'AE', 'SA', 'QA', 'OM', 'KW', 'BH', 'JO', 'LB', 'IQ', 'EG', 'LY', 'TN', 'DZ', 'MA', 'MR', 'YE', 'SY', 'PS' ];

const normalizedCache = new LRUCache<string, string>({
	max: 10000,
});

const allNamesSet = new Set<string>();
const allAbbrsSet = new Set<string>();
const prefixNamesSet: Set<string> = new Set();
const prefixAbbrsSet: Set<string> = new Set();

type CsvLegalFormRow = {
	elfCode: string;
	countryOfFormation: string;
	countryCode: string;
	jurisdictionOfFormation: string;
	countrySubDivisionCode: string;
	entityLegalFormNameLocal: string;
	language: string;
	languageCode: string;
	entityLegalFormNameTransliterated: string;
	abbreviationsLocal: string;
	abbreviationsTransliterated: string;
	dateCreated: string;
	elfStatus: string;
	modification: string;
	modificationDate: string;
	reason: string;
};

export const normalizeLegalName = (name: string) => {
	if (normalizedCache.has(name)) {
		return normalizedCache.get(name)!;
	}

	if (!allNamesSet.size || !allAbbrsSet.size || !prefixNamesSet.size || !prefixAbbrsSet.size) {
		throw new Error('Legal name normalization is not initialized.');
	}

	const normalized = name.trim()
		// Normalize "trading as" names, e.g., "Matteo Martelloni trading as DELUXHOST" => "DELUXHOST"
		.split(/\s+trading as\s+/i).at(-1)!
		// Clean up any double spaces.
		.replace(/\s+/g, ' ')
		// Add missing space after commas, e.g., "Hangzhou Alibaba Advertising Co.,Ltd." => "Hangzhou Alibaba Advertising"
		.replace(/,(?=\S)/g, ', ');

	const words = normalized.split(' ');

	// Searching prefix.
	const firstWord = words[0]!.toLowerCase().replace(/[.,()]/g, '');

	if (prefixNamesSet.has(firstWord) || prefixAbbrsSet.has(firstWord)) {
		words.splice(0, 1);
	}

	// Searching suffix. Starting from the 2nd word, try to remove the longest possible combination.
	for (let i = 1; i < words.length; i++) {
		const combination = words.slice(i).join('').toLowerCase()
			// Suffixes Sets don't include dots, parentheses, commas and spaces, so we are removing them from the combination.
			.replace(/[.,()]/g, '');

		// Remove the last word if it's a hyphen or an ampersand and proceed with suffix search.
		if (([ '-', '&' ].includes(words[i]!) && i === words.length - 1)) {
			words.splice(i);
			i = 0;
			continue;
		}

		if (
			allNamesSet.has(combination)
			|| allAbbrsSet.has(combination)
		) {
			words.splice(i);

			if (
				// If prev word ends with one of the following, proceed with suffix search.
				words[i - 1]!.endsWith('.')
				|| words[i - 1]!.endsWith('.,')
				|| words[i - 1]!.endsWith(')')
				|| words[i - 1]!.endsWith('),')
				// Move to the next iteration to remove hyphen or ampersand there.
				|| [ '-', '&' ].includes(words[i - 1]!)
			) {
				i = 0;
			} else {
				break;
			}
		}
	}

	const result = words.join(' ')
		// Remove trailing commas and spaces after suffix removal.
		.replace(/\s*,\s*$/, '')
		// Remove wrapping quotes that are often used with prefixes.
		.replace(/^"(.*)"$/, '$1');

	normalizedCache.set(name, result);

	return result;
};

export const populateLegalNames = async () => {
	const { allForms, prefixForms } = await readLegalFormsFile();
	const { names: allNames, abbrs: allAbbrs } = await collectLegalForms(allForms);
	const { names: prefixNames, abbrs: prefixAbbrs } = await collectLegalForms(prefixForms, 3);
	allNames.forEach(name => allNamesSet.add(name));
	allAbbrs.forEach(abbr => allAbbrsSet.add(abbr));
	prefixNames.forEach(name => prefixNamesSet.add(name));
	prefixAbbrs.forEach(abbr => prefixAbbrsSet.add(abbr));
};

async function collectLegalForms (legalFormsData: CsvLegalFormRow[], minSynthesizedAbbreviationLength: number = 2) {
	const legalFormsName = new Set<string>();
	const legalFormsAbbr = new Set<string>();

	legalFormsData.forEach((row) => {
		const toAscii = CUSTOM_TRANSLITERATIONS.includes(row.languageCode)
			? (s: string) => transliterate(s, { locale: row.languageCode })
			: ascii;

		const abbrLocal = row.abbreviationsLocal.trim().toLowerCase();

		abbrLocal.split(';').forEach((abbr) => {
			if (abbr.trim()) {
				legalFormsAbbr.add(toAscii(abbr.trim()).replace(/[., ()]/g, ''));
			}
		});

		const abbrTransliterated = row.abbreviationsTransliterated.trim().toLowerCase();

		abbrTransliterated.split(';').forEach((abbr) => {
			if (abbr.trim()) {
				legalFormsAbbr.add(toAscii(abbr.trim()).replace(/[., ()]/g, ''));
			}
		});

		const nameLocal = row.entityLegalFormNameLocal.trim().toLowerCase();

		if (nameLocal) {
			legalFormsName.add(toAscii(nameLocal).replace(/[., ()]/g, ''));

			if (!abbrLocal) {
				const abbrParts = nameLocal.split(' ').filter(is.truthy);

				if (abbrParts.length >= minSynthesizedAbbreviationLength) {
					legalFormsAbbr.add(toAscii(abbrParts.map(w => `${w[0]}`).join('')).replace(/[., ()]/g, ''));
				}
			}
		}

		const nameTransliterated = row.entityLegalFormNameTransliterated.trim().toLowerCase();

		if (nameTransliterated) {
			legalFormsName.add(toAscii(nameTransliterated.trim()).replace(/[., ()]/g, ''));
		}
	});

	ADDITIONAL_LEGAL_FORMS.forEach(({ name, abbr }) => {
		legalFormsName.add(ascii(name).toLowerCase().replace(/[., ()]/g, ''));
		abbr.forEach(a => legalFormsAbbr.add(ascii(a).toLowerCase().replace(/[., ()]/g, '')));
	});

	return { names: legalFormsName, abbrs: legalFormsAbbr };
}

const readLegalFormsFile = () => new Promise<{ allForms: CsvLegalFormRow[]; prefixForms: CsvLegalFormRow[] }>((resolve, reject) => {
	const allForms: CsvLegalFormRow[] = [];
	const prefixForms: CsvLegalFormRow[] = [];

	fs.createReadStream(`data/${LEGAL_FORMS_FILENAME}`)
		.pipe(csvParser({
			headers: [ 'elfCode', 'countryOfFormation', 'countryCode', 'jurisdictionOfFormation', 'countrySubDivisionCode', 'entityLegalFormNameLocal', 'language', 'languageCode', 'entityLegalFormNameTransliterated', 'abbreviationsLocal', 'abbreviationsTransliterated', 'dateCreated', 'elfStatus', 'modification', 'modificationDate', 'reason' ],
			separator: ',',
			skipLines: 1,
		}))
		.on('data', (form: CsvLegalFormRow) => {
			if (PREFIX_USING_COUNTRIES.includes(form.countryCode)) {
				prefixForms.push(form);
			}

			allForms.push(form);
		})
		.on('end', () => resolve({ allForms, prefixForms }))
		.on('error', err => reject(err));
});
