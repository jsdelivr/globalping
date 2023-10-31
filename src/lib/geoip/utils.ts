import anyAscii from 'any-ascii';
import { cities } from './altnames.js';

export const normalizeCityNamePublic = (name: string): string => {
	// We don't add city to the regex as there are valid names like 'Mexico City' or 'Kansas City'
	const asciiName = anyAscii(name).replace(/(?:\s+|^)the(?:\s+|$)/gi, '');
	return cities[asciiName] ?? asciiName;
};

export const normalizeCityName = (name: string): string => normalizeCityNamePublic(name).toLowerCase();

export const normalizePublicName = (name: string): string => name.toLowerCase();

export const normalizeNetworkName = (name: string): string => name.toLowerCase();
