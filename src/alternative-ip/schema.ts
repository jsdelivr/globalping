import Joi from 'joi';

export const schema = Joi.object({
	socketId: Joi.string().length(20).required(),
	token: Joi.string().uuid().required(),
});
