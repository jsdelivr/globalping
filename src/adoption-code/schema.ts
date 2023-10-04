import Joi from 'joi';

export const schema = Joi.object({
	ip: Joi.string().ip().required(),
	code: Joi.string().length(6).required(),
});
