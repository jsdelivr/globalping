import fs from 'node:fs';
import ascii from 'any-ascii';
import csvParser from 'csv-parser';
import transliterate from '@sindresorhus/transliterate';
import is from '@sindresorhus/is';
import _ from 'lodash';

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
];

// Some languages have custom transliteration rules.
const CUSTOM_TRANSLITERATIONS = [ 'da', 'de', 'hu', 'nb', 'sr', 'sv', 'tr' ];

// Countries that sometimes write the legal form as a prefix instead of a suffix.
// We don't allow this for all countries to reduce false-positive matches.
const PREFIX_USING_COUNTRIES = [ 'RO', 'LV', 'LT', 'EE', 'RU', 'UA', 'BY', 'MD', 'GE', 'AM', 'AZ', 'KZ', 'KG', 'UZ', 'TJ', 'TM', 'FI', 'FO', 'JP', 'KR', 'TW', 'VN', 'TH', 'ID', 'IR', 'AE', 'SA', 'QA', 'OM', 'KW', 'BH', 'JO', 'LB', 'IQ', 'EG', 'LY', 'TN', 'DZ', 'MA', 'MR', 'YE', 'SY', 'PS' ];

let legalSuffixNamesPattern: RegExp;
let legalSuffixAbbrsPattern: RegExp;
let legalPrefixNamesPattern: RegExp;
let legalPrefixAbbrsPattern: RegExp;

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
	if (!legalSuffixNamesPattern || !legalSuffixAbbrsPattern || !legalPrefixNamesPattern || !legalPrefixAbbrsPattern) {
		throw new Error('Legal name normalization is not initialized.');
	}

	return name.trim()
		// Normalize "trading as" names, e.g., "Matteo Martelloni trading as DELUXHOST" => "DELUXHOST"
		.split(/\s+trading as\s+/i).at(-1)!
		// Apply the main cleanup patterns.
		.replace(legalSuffixNamesPattern, '').trim()
		.replace(legalSuffixAbbrsPattern, '').trim()
		.replace(legalPrefixNamesPattern, '').trim()
		.replace(legalPrefixAbbrsPattern, '').trim()
		// Clean up any double spaces.
		.replace(/\s+/g, ' ')
		// Remove wrapping quotes that are often used with prefixes.
		.replace(/^"(.*)"$/, '$1')
		// Remove trailing commas and spaces after suffix removal.
		.replace(/\s*,\s*$/, '');
};

export const populateLegalNames = async () => {
	const { allForms, prefixForms } = await readLegalFormsFile();
	const { names: allNames, abbrs: allAbbrs } = await collectLegalForms(allForms);
	const { names: prefixNames, abbrs: prefixAbbrs } = await collectLegalForms(prefixForms, 3);
	({ namesPattern: legalSuffixNamesPattern, abbrsPattern: legalSuffixAbbrsPattern } = buildSuffixPatterns(allNames, allAbbrs));
	({ namesPattern: legalPrefixNamesPattern, abbrsPattern: legalPrefixAbbrsPattern } = buildPrefixPatterns(prefixNames, prefixAbbrs));
};

function buildSuffixPatterns (names: string[], abbrs: string[]) {
	return buildPatterns(names, abbrs, (patterns: string[]) => {
		// Remove one or more patterns from the end; multiple patterns are only removed if:
		//  - the first patterns ends with a dot or a closing parenthesis, optionally followed by a comma, or,
		//  - the first pattern is followed by an ampersand or a hyphen.
		return new RegExp(`\\s+(?:(?:${patterns.join('|')})(?:(?<=[.)]),?\\s*|\\s*[&-]\\s*|$))+$`, 'i');
	});
}

function buildPrefixPatterns (names: string[], abbrs: string[]) {
	return buildPatterns(names, abbrs, (patterns: string[]) => {
		return new RegExp(`^(?:${patterns.join('|')}),?\\s+`, 'i');
	});
}

function buildPatterns (names: string[], abbrs: string[], builder: (patterns: string[]) => RegExp) {
	const preparedNames: string[] = [];
	const preparedAbbrs: string[] = [];

	for (const name of names) {
		const namePattern = _.escapeRegExp(name)
			// Add a dot to the end of each word.
			.replace(/([^.])(?:\s+|$)/g, '$1\\.')
			// Remove whitespace after dots.
			.replace(/\.\s+/g, '.')
			// Allow whitespace after dots, make all existing dots replaceable by whitespace.
			.replace(/\\\.(?=.)/g, '[.\\s]\\s*')
			// Make the final dot optional.
			.replace(/\.$/, '.?');

		preparedNames.push(namePattern);
	}

	for (const abbr of abbrs) {
		const abbrPattern = _.escapeRegExp(abbr)
			// Add a dot to the end of each word.
			.replace(/([^.])(?:\s+|$)/g, '$1\\.')
			// Remove whitespace after dots.
			.replace(/\.\s+/g, '.')
			// Allow whitespace after dots, make all existing dots optional.
			.replace(/\\\.(?=.)/g, '\\.?\\s*')
			// Allow optional dots or whitespace between any two word characters
			.replace(/(?<=\w)(?=\w)/g, '[.\\s]*')
			// Make the final dot optional.
			.replace(/\.$/, '.?');

		// Allow the whole abbreviation to be wrapped in parentheses.
		preparedAbbrs.push(`\\(?${abbrPattern}\\)?`);
	}

	return {
		namesPattern: builder(preparedNames),
		abbrsPattern: builder(preparedAbbrs),
	};
}

async function collectLegalForms (legalFormsData: CsvLegalFormRow[], synthesizeAbbreviations: number = 2) {
	const legalFormsName = new Set<string>();
	const legalFormsAbbr = new Set<string>();

	legalFormsData.forEach((row) => {
		const toAscii = CUSTOM_TRANSLITERATIONS.includes(row.languageCode)
			? (s: string) => transliterate(s, { locale: row.languageCode })
			: ascii;

		const abbrLocal = row.abbreviationsLocal.trim().toLowerCase();

		abbrLocal.split(';').forEach((abbr) => {
			if (abbr.trim()) {
				legalFormsAbbr.add(toAscii(abbr.trim()));
			}
		});

		const abbrTransliterated = row.abbreviationsTransliterated.trim().toLowerCase();

		abbrTransliterated.split(';').forEach((abbr) => {
			if (abbr.trim()) {
				legalFormsAbbr.add(toAscii(abbr.trim()));
			}
		});

		const nameLocal = row.entityLegalFormNameLocal.trim().toLowerCase();

		if (nameLocal) {
			legalFormsName.add(toAscii(nameLocal));

			if (!abbrLocal) {
				const abbrParts = nameLocal.split(' ').filter(is.truthy);

				if (abbrParts.length >= synthesizeAbbreviations) {
					legalFormsAbbr.add(toAscii(abbrParts.map(w => `${w[0]}.`).join('')));
				}
			}
		}

		const nameTransliterated = row.entityLegalFormNameTransliterated.trim().toLowerCase();

		if (nameTransliterated) {
			legalFormsName.add(toAscii(nameTransliterated.trim()));
		}
	});

	ADDITIONAL_LEGAL_FORMS.forEach(({ name, abbr }) => {
		legalFormsName.add(ascii(name).toLowerCase());
		abbr.forEach(a => legalFormsAbbr.add(ascii(a).toLowerCase()));
	});

	// Convert to array and sort by length (longest first) to avoid partial matches
	return {
		names: Array.from(legalFormsName)
			.sort((a, b) => b.length - a.length),
		abbrs: Array.from(legalFormsAbbr)
			.sort((a, b) => b.length - a.length),
	};
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
