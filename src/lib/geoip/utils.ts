import anyAscii from 'any-ascii';

export const normalizeCityName = (name: string): string => anyAscii(name).toLowerCase();
export const normalizeNetworkName = (name: string): string => name.toLowerCase();
