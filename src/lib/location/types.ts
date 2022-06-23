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
	value: string;
};

type AsnLocation = {
	type: 'asn';
	value: number;
};

type MagicLocation = {
	type: 'magic';
	value: string;
};

export type Location =
	ContinentLocation
	| RegionLocation
	| CountryLocation
	| StateLocation
	| CityLocation
	| AsnLocation
	| MagicLocation;
