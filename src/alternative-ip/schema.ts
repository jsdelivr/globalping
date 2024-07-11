import Joi from 'joi';
import { globalIpOptions } from '../measurement/schema/utils.js';

export const schema = Joi.object({
	socketId: Joi.string().length(20).required(),
	ip: Joi.string().ip(globalIpOptions).required(),
	token: Joi.string().uuid().required(),
});
