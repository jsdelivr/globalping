import Joi from 'joi';

export const schema = Joi.object({
	since: Joi.number().integer().min(0),
});
