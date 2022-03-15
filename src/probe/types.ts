export type Probe = {
	client: string;
	ipAddress: string;
	location: {
		continent: string;
		region: string;
		country: string;
		state: string | undefined;
		city: number;
		asn: number;
	};
};
