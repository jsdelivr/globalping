import anyAscii from 'any-ascii';

export const normalizeCityName = (name: string): string => anyAscii(name).toLowerCase().replace(/(?:\s+|^)(?:the|city)(?:\s+|$)/gi, '');
export const normalizeNetworkName = (name: string): string => name.toLowerCase();
export const prettifyRegionName = (name: string): string => name.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
