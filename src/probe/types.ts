export type Probe = {
	client: string;
	ipAddress: string;
	location: {
		continent: string;
		region: string;
		country: string;
		city: number;
		asn: number;
		state?: string;
	};
};
