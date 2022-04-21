import type {Schema} from 'joi';
import type {Context, Next} from 'koa';
import {validCmdTypes} from '../../../measurement/schema/command-schema.js';

type DeepFieldDetails = {
	message: string;
	path: string[];
};

export const validate = (schema: Schema) => async (ctx: Context, next: Next) => {
	const valid = schema.validate(ctx.request.body, {convert: true});

	if (valid.error) {
		const deepErrorMatch = valid.error.details
			.filter(field => field?.context!['details'])
			.flatMap(field => (field.context!['details'] as DeepFieldDetails))
			.filter(item => item && !(
				item.path.includes('type') && validCmdTypes.includes(valid.error._original.measurement.type,
				)));

		const finalError = deepErrorMatch.length > 0 ? deepErrorMatch : valid.error.details;
		const fields = finalError.map(field => ([field.path.join('.'), field.message]));

		ctx.status = 422;
		ctx.body = {
			error: {
				message: 'Validation Failed',
				type: 'invalid_request_error',
				params: Object.fromEntries(fields) as never,
			},
		};
		return;
	}

	ctx.request.body = valid.value as never;
	await next();
};
