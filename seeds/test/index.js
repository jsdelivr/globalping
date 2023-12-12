export const seed = async (db) => {
	await db('directus_users').insert({
		id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
		github: 'jimaek',
	});

	await db('adopted_probes').insert({
		userId: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
		lastSyncDate: db.fn.now(),
		ip: '51.158.22.211',
		uuid: 'c77f021d-23ff-440a-aa96-35e82c73e731',
		isCustomCity: 1,
		tags: '["mytag1"]',
		status: 'ready',
		version: '0.26.0',
		country: 'FR',
		city: 'Marseille',
		latitude: '43.29695',
		longitude: '5.38107',
		network: 'SCALEWAY S.A.S.',
		asn: 12876,
		countryOfCustomCity: 'FR',
	});
};
