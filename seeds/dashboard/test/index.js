export const seed = async (db) => {
	await db('directus_settings').insert({ id: 1, low_credits_default_threshold: 5000 });
};
