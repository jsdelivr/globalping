export type ProbeLocation = {
	continent: string;
	region: string;
	country: string;
	city: string;
	asn: number;
	latitude: number;
	longitude: number;
	state: string | undefined;
	network: string | undefined;
};

export type Probe = {
	client: string;
	version: string | undefined;
	ipAddress: string;
	location: ProbeLocation;
};
