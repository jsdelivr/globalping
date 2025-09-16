import fs from 'node:fs';
import ascii from 'any-ascii';
import csvParser from 'csv-parser';
import is from '@sindresorhus/is';
import _ from 'lodash';

// See https://github.com/jsdelivr/globalping/issues/383
// The CSV file is from https://www.gleif.org/en/lei-data/code-lists/iso-20275-entity-legal-forms-code-list
const FILENAME = '2023-09-28-elf-code-list-v1.5.csv';

const ADDITIONAL_SUFFIXES = [
	{ name: 'Limitada', abbr: [ 'LDA' ] }, // Portugal
];

let namesPattern: RegExp;
let abbrsPattern: RegExp;

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
	if (!namesPattern || !abbrsPattern) {
		throw new Error('Legal name normalization is not initialized.');
	}

	return name.trim()
		// Normalize "trading as" names, e.g., "Matteo Martelloni trading as DELUXHOST" => "DELUXHOST"
		.split(/\s+trading as\s+/i).at(-1)!
		// Apply the main cleanup patterns.
		.replace(namesPattern, '').trim()
		.replace(abbrsPattern, '').trim()
		// Clean up any double spaces
		.replace(/\s+/g, ' ')
		// Remove trailing commas and spaces after suffix removal
		.replace(/\s*,\s*$/, '');
};

export const populateLegalNames = async () => {
	const { names, abbrs } = await collectLegalForms();
	({ namesPattern, abbrsPattern } = buildPatterns(names, abbrs));
};

function buildPatterns (names: string[], abbrs: string[]) {
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

	const buildPattern = (patterns: string[]) => {
		// Remove one or more patterns from the end; multiple patterns are only removed if:
		//  - the first patterns ends with a dot or a closing parenthesis, optionally followed by a comma, or,
		//  - the first pattern is followed by an ampersand or a hyphen.
		return new RegExp(`\\s+(?:(?:${patterns.join('|')})(?:(?<=[.)]),?\\s*|\\s*[&-]\\s*|$))+$`, 'i');
	};

	return {
		namesPattern: buildPattern(preparedNames),
		abbrsPattern: buildPattern(preparedAbbrs),
	};
}

async function collectLegalForms () {
	const legalFormsData = await readLegalFormsFile();
	const legalFormsLong = new Set<string>();
	const legalFormsAbbr = new Set<string>();

	legalFormsData.forEach((row) => {
		const abbrLocal = row.abbreviationsLocal.trim();

		abbrLocal.split(';').forEach((abbr) => {
			if (abbr.trim()) {
				legalFormsAbbr.add(ascii(abbr.trim()));
			}
		});

		const abbrTransliterated = row.abbreviationsTransliterated.trim();

		abbrTransliterated.split(';').forEach((abbr) => {
			if (abbr.trim()) {
				legalFormsAbbr.add(ascii(abbr.trim()));
			}
		});

		const nameLocal = row.entityLegalFormNameLocal.trim();

		if (nameLocal) {
			legalFormsLong.add(ascii(nameLocal));

			if (!abbrLocal) {
				const abbr = nameLocal.split(' ').filter(is.truthy).map(w => `${w[0]}.`).join('');
				legalFormsAbbr.add(ascii(abbr));
			}
		}

		const nameTransliterated = row.entityLegalFormNameTransliterated.trim();

		if (nameTransliterated) {
			legalFormsLong.add(ascii(nameTransliterated.trim()));
		}
	});

	ADDITIONAL_SUFFIXES.forEach(({ name, abbr }) => {
		legalFormsLong.add(ascii(name));
		abbr.forEach(a => legalFormsAbbr.add(ascii(a)));
	});

	// Convert to array and sort by length (longest first) to avoid partial matches
	return {
		names: Array.from(legalFormsLong)
			.sort((a, b) => b.length - a.length),
		abbrs: Array.from(legalFormsAbbr)
			.sort((a, b) => b.length - a.length),
	};
}

const readLegalFormsFile = () => new Promise<CsvLegalFormRow[]>((resolve, reject) => {
	const legalForms: CsvLegalFormRow[] = [];

	fs.createReadStream(`data/${FILENAME}`)
		.pipe(csvParser({
			headers: [ 'elfCode', 'countryOfFormation', 'countryCode', 'jurisdictionOfFormation', 'countrySubDivisionCode', 'entityLegalFormNameLocal', 'language', 'languageCode', 'entityLegalFormNameTransliterated', 'abbreviationsLocal', 'abbreviationsTransliterated', 'dateCreated', 'elfStatus', 'modification', 'modificationDate', 'reason' ],
			separator: ',',
			// skipLines: 1,
		}))
		.on('data', (form: CsvLegalFormRow) => {
			legalForms.push(form);
		})
		.on('end', () => resolve(legalForms))
		.on('error', err => reject(err));
});
