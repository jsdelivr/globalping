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

export type Probe = {
	ready: boolean;
	client: string;
	version: string | undefined;
	ipAddress: string;
	location: ProbeLocation;
	index: string[];
	resolvers: string[];
};
