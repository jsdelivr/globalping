import got from 'got';
import csvParser from 'csv-parser';
import { writeFile } from 'node:fs/promises';
import { normalizeLegalName, populateLegalNames } from './legal-name-normalization.js';
import anyAscii from 'any-ascii';
import fs from 'fs';

const SOURCE_URL = 'https://cdn.jsdelivr.net/gh/ipverse/asn-info@master/as.csv';
const FILENAME = 'ASN_INFO.csv';
const ASNS = new Map<string, string>();

function csvEscape (value: string): string {
	if (value == null) {
		return '""';
	}

	return `"${value.replace(/"/g, '""')}"`;
}

function letterStats (s: string) {
	let upper = 0;
	let lower = 0;

	for (const ch of s) {
		if (ch >= 'A' && ch <= 'Z') {
			upper++;
		} else if (ch >= 'a' && ch <= 'z') {
			lower++;
		}
	}

	const isAllLower = upper === 0 && lower > 0;
	const isAllUpper = lower === 0 && upper > 0;

	// Category for sorting (low -> high):
	// 0 = all lowercase, 1 = all uppercase, 2 = mixed/other
	const category = isAllLower ? 0 : (isAllUpper ? 1 : 2);
	return { upper, lower, category };
}

async function fetchDescriptions (): Promise<Set<string>> {
	return new Promise((resolve, reject) => {
		const result = new Set<string>();
		const stream = got.stream(SOURCE_URL);

		stream
			.pipe(csvParser({
				mapHeaders: ({ header }) => header.toLowerCase(),
			}))
			.on('data', (row: Record<string, string>) => {
				const desc = (row['description'] || '').trim();

				if (desc) {
					result.add(desc);
				}
			})
			.on('end', () => resolve(result))
			.on('error', reject);
	});
}

export const populateAsnData = async () => {
	return new Promise<Map<string, string>>((resolve, reject) => {
		const stream = fs.createReadStream(`data/${FILENAME}`);

		stream
			.pipe(csvParser())
			.on('data', (row: Record<string, string>) => {
				const normCasing = row['Normalized Casing'];

				if (normCasing) {
					ASNS.set(normCasing.toLowerCase(), normCasing);
				}
			})
			.on('end', resolve)
			.on('error', reject);
	});
};

export const getAsnName = (name: string): string => {
	return ASNS.get(name.toLowerCase()) ?? name;
};

export async function updateAsnData () {
	await populateLegalNames();

	const descriptions = await fetchDescriptions();

	// First pass: compute normalized variants and group by their lowercase form
	const normalizedByOriginal = new Map<string, string>();
	const groups = new Map<string, Set<string>>();

	for (const original of descriptions) {
		const normalized = normalizeLegalName(anyAscii(original));
		normalizedByOriginal.set(original, normalized);
		const key = normalized.toLowerCase();

		if (!groups.has(key)) {
			groups.set(key, new Set<string>());
		}

		groups.get(key)!.add(normalized);
	}

	// Decide the canonical "normalized casing" per group
	const normalizedCasingByKey = new Map<string, string>();

	for (const [ key, variants ] of groups) {
		const sorted = Array.from(variants).sort((a, b) => {
			const sa = letterStats(a);
			const sb = letterStats(b);

			if (sa.category !== sb.category) {
				return sb.category - sa.category;
			}

			if (sa.category === 2) {
				return sb.upper - sa.upper;
			}

			return 0;
		});

		normalizedCasingByKey.set(key, sorted[0]!);
	}

	// Build CSV
	const lines: string[] = [];
	lines.push('Original,Normalized,Normalized Casing');

	for (const original of descriptions) {
		const normalized = normalizedByOriginal.get(original)!;
		const normCasing = normalizedCasingByKey.get(normalized.toLowerCase())!;
		lines.push(`${csvEscape(original)},${csvEscape(normalized)},${csvEscape(normCasing)}`);
	}

	const csv = lines.join('\n');

	await writeFile(`data/${FILENAME}`, csv + '\n');
}
