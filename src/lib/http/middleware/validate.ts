import type {Schema} from 'joi';
import type {Context, Next} from 'koa';

export const validate = (schema: Schema) => async (ctx: Context, next: Next) => {
	const valid = schema.validate(ctx.request.body);

	if (valid.error) {
		const fields = valid.error.details.map(field => ([field.path.join('.'), field.message]));

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
