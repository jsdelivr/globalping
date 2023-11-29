export type ProbeLocation = {
	continent: string;
	region: string;
	country: string;
	city: string;
	normalizedCity: string;
	asn: number;
	latitude: number;
	longitude: number;
	state: string | null;
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
	type: 'system' | 'admin' | 'user' | 'offline';
	value: string;
};

export type Probe = {
	status: 'initializing' | 'ready' | 'unbuffer-missing' | 'ping-test-failed' | 'sigterm' | 'offline';
	client: string;
	version: string;
	nodeVersion: string;
	uuid: string;
	isHardware: boolean;
	hardwareDevice: string | null;
	ipAddress: string;
	host: string;
	location: ProbeLocation;
	index: string[][];
	resolvers: string[];
	tags: Tag[];
	stats: ProbeStats;
};
