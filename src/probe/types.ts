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
	allowedCountries: string[];
};

export type ExtendedProbeLocation = ProbeLocation & {
	groupingKey: string;
};

export type ExtendedProbeLocationWithOverrides = ExtendedProbeLocation & {
	hasOverridesApplied: true;
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
	subtype?: 'cloud';
	value: string;
};

export type ProbeIndex = [ string[], string[], string[], string[], string[], string[], string[], string[], string[], string[], string[], string[], string[], string[], string[], string[] ];

type Probe = {
	status: 'initializing' | 'getting-alt-ips' | 'ready' | 'unbuffer-missing' | 'ping-test-failed' | 'sigterm';
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
	index: ProbeIndex;
	resolvers: string[];
	tags: Tag[];
	normalizedTags: Tag[];
	stats: ProbeStats;
	hostInfo: HostInfo;
	adoptionToken: string | null;
	nodeId?: string;
	isProxy: boolean | null;
};

type Modify<T, Fields> = Omit<T, keyof Fields> & Fields;

export type SocketProbe = Modify<Probe, {
	location: ExtendedProbeLocation;
}>;

export type ServerProbe = Readonly<Modify<Probe, {
	location: ExtendedProbeLocationWithOverrides;
	owner?: { id: string };
}>>;

export type OfflineProbe = Modify<SocketProbe, {
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
	};
	index: [];
	tags: {
		type: 'offline';
		value: string;
	}[];
	normalizedTags: {
		type: 'offline';
		value: string;
	}[];
	stats: {
		cpu: {
			load: [];
		};
		jobs: {
			count: null;
		};
	};
}>;
