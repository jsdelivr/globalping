import type { Schema } from 'joi';
import type { Context, Next } from 'koa';

export const validate = (schema: Schema) => async (ctx: Context, next: Next) => {
	const valid = schema.validate(ctx.request.body, { convert: true });

	if (valid.error) {
		const fields = valid.error.details.map(field => [ field.path.join('.'), String(field?.message) ]);

		ctx.status = 400;

		ctx.body = {
			error: {
				type: 'validation_error',
				message: 'Parameter validation failed.',
				params: Object.fromEntries(fields) as never,
			},
		};

		return;
	}

	ctx.request.body = valid.value as never;
	await next();
};
