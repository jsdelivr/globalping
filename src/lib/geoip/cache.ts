import config from 'config';
import {getRedisClient} from '../redis/client.js';
import type {
	LocationInfo,
} from './types.js';
import type {
	FastlyClientInfo,
	FastlyBundledResponse,
} from './fastly.js';

const redisClient = getRedisClient();

export const genLocationKey = (addr: string, provider: string): string => `gp:geoip:location:${provider}:${addr}`;
export const genClientKey = (addr: string): string => `gp:geoip:client:${addr}`;

export const getLocation = async (addr: string, provider: string): Promise<LocationInfo> => redisClient.json.get(genLocationKey(addr, provider)) as Promise<LocationInfo>;
export const getClientData = async (addr: string): Promise<FastlyClientInfo> => redisClient.json.get(genClientKey(addr)) as Promise<FastlyClientInfo>;

export const getLocationWithClient = async (addr: string, provider: string): Promise<FastlyBundledResponse> => {
	const location = await redisClient.json.get(genLocationKey(addr, provider)) as LocationInfo;
	const client = await redisClient.json.get(genClientKey(addr)) as FastlyClientInfo;

	return {
		location,
		client,
	};
};

export const setLocation = async (addr: string, provider: string, location: LocationInfo): Promise<void> => {
	const key = genLocationKey(addr, provider);
	const ttl = config.get<number>('geoip.cache.ttl');

	const parsedLocation = Object.fromEntries(Object.entries(location).filter(field => typeof field[1] !== 'undefined'));

	await redisClient.executeIsolated(async client => {
		await client.json.set(key, '$', parsedLocation as Record<string, string | number>);
		await client.expire(key, ttl);
	});
};

export const setClientData = async (addr: string, clientData: FastlyClientInfo): Promise<void> => {
	const key = genClientKey(addr);
	const ttl = config.get<number>('geoip.cache.ttl');

	await redisClient.executeIsolated(async client => {
		await client.json.set(key, '$', clientData as Record<string, string>);
		await client.expire(key, ttl);
	});
};

export const delLocation = async (addr: string, provider: string): Promise<void> => {
	await redisClient.json.del(genLocationKey(addr, provider));
};

export const delClientData = async (addr: string): Promise<void> => {
	await redisClient.json.del(genClientKey(addr));
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const GeoIpCache = {
	getClientData,
	setClientData,
	delClientData,
	getLocation,
	setLocation,
	delLocation,
};

export default GeoIpCache;
