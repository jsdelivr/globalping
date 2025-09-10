import Joi from 'joi';

export const schema = Joi.object({
	after: Joi.string().pattern(/^(?:-|\d+-\d+)$/).optional(),
}).unknown(false);
