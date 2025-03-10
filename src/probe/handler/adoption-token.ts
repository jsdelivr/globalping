import { adoptionToken } from '../../adoption/adoption-token.js';
import { adoptionTokenSchema } from '../schema/probe-response-schema.js';
import type { Probe } from '../types.js';

export const handleAdoptionToken = (probe: Probe) => async (token: string): Promise<void> => {
	const validation = adoptionTokenSchema.validate(token);

	if (validation.error) {
		throw validation.error;
	}

	await adoptionToken.validate(token, probe);
};
