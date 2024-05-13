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
	type: 'system' | 'admin' | 'user';
	value: string;
};

export type Probe = {
	status: 'initializing' | 'ready' | 'unbuffer-missing' | 'ping-test-failed' | 'sigterm';
	isIPv4Supported: boolean;
	isIPv6Supported: boolean;
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

type Modify<T, Fields> = Omit<T, keyof Fields> & Fields;

export type OfflineProbe = Modify<Probe, {
	status: 'offline';
	isIPv4Supported: boolean;
	isIPv6Supported: boolean;
	client: null;
	version: null;
	nodeVersion: null;
	uuid: null;
	isHardware: false;
	hardwareDevice: null;
	ipAddress: string;
	host: null;
	index: [];
	tags: {
		type: 'offline';
		value: string;
	}[];
	stats: {
		cpu: {
			count: 0;
			load: [];
		};
		jobs: {
			count: 0
		};
	};
}>
