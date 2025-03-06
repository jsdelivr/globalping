import Joi from 'joi';
import { globalIpOptions } from '../measurement/schema/utils.js';

export const schema = Joi.object({
	ip: Joi.string().ip(globalIpOptions).required(),
	code: Joi.string().length(6).required(),
});
