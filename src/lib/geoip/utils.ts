import anyAscii from 'any-ascii';
import { cities } from './altnames.js';
import { Tag } from '../../probe/types.js';
import { normalizeLegalName } from './legal-name-normalization.js';

export const normalizeCityNamePublic = (name: string): string => {
	// We don't add city to the regex as there are valid names like 'Mexico City' or 'Kansas City'
	const asciiName = anyAscii(name).replace(/(?:\s+|^)the(?:\s+|$)/gi, '');
	return cities[asciiName] ?? asciiName;
};

export const normalizeCityName = (name: string): string => normalizeCityNamePublic(name).toLowerCase();

export const normalizeFromPublicName = (name: string): string => name.toLowerCase();

export const normalizeNetworkNamePublic = (name: string): string => {
	return normalizeLegalName(name);
};

export const normalizeNetworkName = (name: string): string => normalizeNetworkNamePublic(name).toLowerCase();

export const normalizeCoordinate = (coordinate: number) => Math.round(coordinate * 100) / 100;

export const normalizeTags = (tags: Tag[]) => tags.map(tag => ({ type: tag.type, value: tag.value.toLowerCase() }));

export const getGroupingKey = (country: string, state: string | null, normalizedCity: string, asn: number) => `${country}-${state}-${normalizedCity}-${asn}`;
