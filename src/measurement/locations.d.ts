type Continent = {
	type: 'continent';
	value: 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'SA' | 'OC';
};

type Region = {
	type: 'region';
	value: 'northern-europe'
	| 'southern-europe'
	| 'western-europe'
	| 'eastern-europe'
	| 'southern-asia'
	| 'south-eastern-asia'
	| 'western-asia'
	| 'eastern-asia'
	| 'central-asia'
	| 'western-africa'
	| 'eastern-africa'
	| 'southern-africa'
	| 'northern-africa'
	| 'middle-africa'
	| 'central-america'
	| 'northern-america'
	| 'southern-america'
	| 'caribbean'
	| 'polynesia'
	| 'melanesia'
	| 'micronesia';
};

type Country = {
	type: 'country';
	value: string;
};

type City = {
	type: 'city';
	value: number;
};

type Asn = {
	type: 'asn';
	value: number;
};

export type Location = Continent | Region | Country | City | Asn;
