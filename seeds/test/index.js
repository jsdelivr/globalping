export const seed = async (db) => {
	await db('directus_users').insert({
		id: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
		github: 'jimaek',
	});
};
