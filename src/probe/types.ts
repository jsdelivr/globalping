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
		load: Array<{
			usage: number;
		}>;
	};
	jobs: {
		count: number;
	};
};

export type HostInfo = {
	totalMemory: number;
	totalDiskSize: number;
	availableDiskSpace: number;
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
	hardwareDeviceFirmware: string | null;
	ipAddress: string;
	altIpAddresses: string[];
	host: string;
	location: ProbeLocation;
	index: string[][];
	resolvers: string[];
	tags: Tag[];
	stats: ProbeStats;
	hostInfo: HostInfo;
	owner?: { id: string };
	adoptionToken: string | null;
};

type Modify<T, Fields> = Omit<T, keyof Fields> & Fields;

export type OfflineProbe = Modify<Probe, {
	status: 'offline';
	client: null;
	version: null;
	nodeVersion: null;
	uuid: null;
	isHardware: false;
	hardwareDevice: null;
	hardwareDeviceFirmware: null;
	host: null;
	hostInfo: {
		totalMemory: null;
		totalDiskSize: null;
		availableDiskSpace: null;
	}
	index: [];
	tags: {
		type: 'offline';
		value: string;
	}[];
	stats: {
		cpu: {
			load: [];
		};
		jobs: {
			count: null
		};
	};
}>
