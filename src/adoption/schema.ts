import Joi from 'joi';

export const schema = Joi.object({
	ip: Joi.string().ip().required(),
	code: Joi.string().required().length(6),
});
