export type ProbeLocation = {
	continent: string;
	region: string;
	country: string;
	city: string;
	asn: number;
	latitude: number;
	longitude: number;
	state: string | undefined;
};

export type Probe = {
	client: string;
	ipAddress: string;
	location: ProbeLocation;
};
