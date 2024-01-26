export const seed = async (db) => {
	await db('gp_tokens').insert({
		user_created: '89da69bd-a236-4ab7-9c5d-b5f52ce09959',
		value: '7emhYIar8eLtwAAjyXUn+h3Cj+Xc9BQcLMC6JAX9fHQ=',
	});
};
