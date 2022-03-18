type ContinentLocation = {
	type: 'continent';
	value: string;
};

type RegionLocation = {
	type: 'region';
	value: string;
};

type CountryLocation = {
	type: 'country';
	value: string;
};

type StateLocation = {
	type: 'state';
	value: string;
};

type CityLocation = {
	type: 'city';
	value: number;
};

type AsnLocation = {
	type: 'asn';
	value: number;
};

export type Location =
	ContinentLocation
	| RegionLocation
	| CountryLocation
	| StateLocation
	| CityLocation
	| AsnLocation;
