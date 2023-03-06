export type ProbeLocation = {
	continent: string;
	region: string;
	normalizedRegion: string;
	country: string;
	city: string;
	normalizedCity: string;
	asn: number;
	latitude: number;
	longitude: number;
	state: string | undefined;
	network: string;
	normalizedNetwork: string;
};

export type ProbeStats = {
	cpu: {
		count: number;
		load: Array<{
			idle: number;
			usage: number;
		}>;
	};
	jobs: {
		count: number;
	};
};

export type Tag = {
	type: 'system' | 'admin' | 'user';
	value: string;
};

export type Probe = {
	status: 'initializing' | 'ready' | 'unbuffer-missing';
	client: string;
	version: string | undefined;
	ipAddress: string;
	host: string;
	location: ProbeLocation;
	index: string[];
	resolvers: string[];
	tags: Tag[];
	stats: ProbeStats;
};
