import Joi from 'joi';
import { globalIpOptions } from '../measurement/schema/utils.js';

export const schema = Joi.object({
	localAddress: Joi.string().ip(globalIpOptions),
});
