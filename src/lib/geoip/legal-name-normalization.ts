import fs from 'node:fs';
import ascii from 'any-ascii';
import csvParser from 'csv-parser';
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
];

// Some languages have custom transliteration rules.
const CUSTOM_TRANSLITERATIONS = [ 'da', 'de', 'hu', 'nb', 'sr', 'sv', 'tr' ];

// Countries that sometimes write the legal form as a prefix instead of a suffix.
// We don't allow this for all countries to reduce false-positive matches.
const PREFIX_USING_COUNTRIES = [ 'RO', 'LV', 'LT', 'EE', 'RU', 'UA', 'BY', 'MD', 'GE', 'AM', 'AZ', 'KZ', 'KG', 'UZ', 'TJ', 'TM', 'FI', 'FO', 'JP', 'KR', 'TW', 'VN', 'TH', 'ID', 'IR', 'AE', 'SA', 'QA', 'OM', 'KW', 'BH', 'JO', 'LB', 'IQ', 'EG', 'LY', 'TN', 'DZ', 'MA', 'MR', 'YE', 'SY', 'PS' ];

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
	if (!allNamesSet.size || !allAbbrsSet.size || !prefixNamesSet.size || !prefixAbbrsSet.size) {
		throw new Error('Legal name normalization is not initialized.');
	}

	const normalized = name.trim()
		// Normalize "trading as" names, e.g., "Matteo Martelloni trading as DELUXHOST" => "DELUXHOST"
		.split(/\s+trading as\s+/i).at(-1)!
		// Clean up any double spaces.
		.replace(/\s+/g, ' ')
		// Normalize whitespace after commas.
		.replace(/,(?=\S)/g, ', ')
		// Normalize whitespace within parentheses.
		.replace(/\(\s+/g, '(')
		.replace(/\s+\)+/g, ')')
		// Normalize whitespace around dashes.
		.replace(/\s*-\s*(me)$/gi, ' - $1')
		.replace(/\s+-\s*|\s*-\s+/g, ' - ')
		.replace(/(?<=\w)\.-\s*/g, '. - ');

	const words = normalized.split(' ');

	const stripSuffixWithSet = (set: Set<string>, stripWhitespace: boolean = true) => {
		// Starting from the 2nd word, try to remove the longest possible sequence.
		let index = 1;

		while (index < words.length) {
			// Remove the last word if it's a hyphen or an ampersand and restart the search.
			if (([ '-', '&' ].includes(words[index]!) && index === words.length - 1)) {
				words.splice(index);
				index = 1;
				continue;
			}

			const parts = words.slice(index);
			const sequence = parts.join(stripWhitespace ? '' : ' ').toLowerCase()
				// Suffix sets don't include dots, parentheses, and commas, so we remove them from the sequence.
				.replace(/[.,()]/g, '');

			if (set.has(sequence) || multiPartMatch(parts, set)) {
				const suffixWords = words.splice(index);

				// Restart the search if one of the conditions is met.
				if (
					words[index - 1]!.endsWith('.')
					|| words[index - 1]!.endsWith('.,')
					|| words[index - 1]!.endsWith(')')
					|| words[index - 1]!.endsWith('),')
					|| [ '-', '&' ].includes(words[index - 1]!)
					|| suffixWords[0]!.startsWith('(')
				) {
					index = 1;
					continue;
				}
			}

			index++;
		}
	};

	const stripPrefixWithSet = (set: Set<string>, stripWhitespace: boolean = true) => {
		for (let i = words.length - 1; i > 0; i--) {
			const sequence = words.slice(0, i).join(stripWhitespace ? '' : ' ').toLowerCase()
				// Suffixes Sets don't include dots, parentheses, commas and spaces, so we are removing them from the combination.
				.replace(/[.,()]/g, '');

			if (set.has(sequence)) {
				words.splice(0, i);
			}
		}
	};

	stripSuffixWithSet(allNamesSet, false);
	stripSuffixWithSet(allAbbrsSet);
	stripPrefixWithSet(prefixNamesSet, false);
	stripPrefixWithSet(prefixAbbrsSet);

	return words.join(' ')
		// Remove trailing commas and spaces after suffix removal.
		.replace(/\s*,\s*$/, '')
		// Remove wrapping quotes that are often used with prefixes.
		.replace(/^"(.*)"$/, '$1');
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

function generatePossiblePartSplits (parts: string[]): string[][] {
	if (parts.length <= 1) {
		return [ parts ];
	}

	const [ first, ...rest ] = parts;

	return generatePossiblePartSplits(rest).flatMap((sub) => {
		if (!sub.length) {
			return [ [ first! ] ];
		}

		return [ [ first!, ...sub ], [ first! + sub[0]!, ...sub.slice(1) ] ];
	});
}

function multiPartMatch (parts: string[], set: Set<string>): boolean {
	return parts.join('').toLowerCase().split('-').every((word) => {
		const parts = word.replace(/[,()]/g, '').split('.');
		const splits = generatePossiblePartSplits(parts);

		for (const split of splits) {
			if (split.every(part => set.has(part))) {
				return true;
			}
		}

		return false;
	});
}

async function collectLegalForms (legalFormsData: CsvLegalFormRow[], minSynthesizedAbbreviationLength: number = 2) {
	const legalFormsName = new Set<string>();
	const legalFormsAbbr = new Set<string>();

	legalFormsData.forEach((row) => {
		const toAscii = CUSTOM_TRANSLITERATIONS.includes(row.languageCode)
			? (s: string) => transliterate(s, { locale: row.languageCode })
			: ascii;

		const toAbbreviation = (s: string) => toAscii(s).replace(/[., ()]/g, '');
		const toName = (s: string) => toAscii(s).replace(/[.,()]/g, '');

		const abbrLocal = row.abbreviationsLocal.trim().toLowerCase();

		abbrLocal.split(';').forEach((abbr) => {
			if (abbr.trim()) {
				legalFormsAbbr.add(toAbbreviation(abbr));
			}
		});

		const abbrTransliterated = row.abbreviationsTransliterated.trim().toLowerCase();

		abbrTransliterated.split(';').forEach((abbr) => {
			if (abbr.trim()) {
				legalFormsAbbr.add(toAbbreviation(abbr));
			}
		});

		const nameLocal = row.entityLegalFormNameLocal.trim().toLowerCase();

		if (nameLocal) {
			legalFormsName.add(toName(nameLocal));

			if (!abbrLocal) {
				const abbrParts = toName(nameLocal).split(' ').filter(is.truthy);

				if (abbrParts.length >= minSynthesizedAbbreviationLength) {
					legalFormsAbbr.add(abbrParts.map(w => `${w[0]}`).join(''));
				}
			}
		}

		const nameTransliterated = row.entityLegalFormNameTransliterated.trim().toLowerCase();

		if (nameTransliterated) {
			legalFormsName.add(toName(nameTransliterated));
		}
	});

	ADDITIONAL_LEGAL_FORMS.forEach(({ name, abbr }) => {
		legalFormsName.add(ascii(name).toLowerCase().replace(/[.,()]/g, ''));
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
			// Exclude some words that generate lots of false positives.
			if (/\bbank\b/i.test(form.entityLegalFormNameLocal)) {
				// return;
			}

			if (PREFIX_USING_COUNTRIES.includes(form.countryCode)) {
				prefixForms.push(form);
			}

			allForms.push(form);
		})
		.on('end', () => resolve({ allForms, prefixForms }))
		.on('error', err => reject(err));
});
