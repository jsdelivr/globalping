import anyAscii from 'any-ascii';

const altNames: Array<[string, string]> = [['Geneve', 'Geneva'], ['Frankfurt am Main', 'Frankfurt'], ['New York City', 'New York']];
const altNamesMap = new Map<string, string>(altNames);

export const normalizeCityNamePublic = (name: string): string => {
	// We don't add city to the regex as there are valid names like 'Mexico City' or 'Kansas City'
	const asciiName = anyAscii(name).replace(/(?:\s+|^)the(?:\s+|$)/gi, '');
	return altNamesMap.get(asciiName) ?? asciiName;
};

export const normalizeCityName = (name: string): string => normalizeCityNamePublic(name).toLowerCase();

export const normalizeNetworkName = (name: string): string => name.toLowerCase();
export const prettifyRegionName = (name: string): string => name.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
