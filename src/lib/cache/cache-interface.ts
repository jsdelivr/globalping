export type CacheInterface = {
	set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
	get<T = unknown>(key: string): Promise<T | null>;
	delete<T = unknown>(key: string): Promise<T | null>;
};
