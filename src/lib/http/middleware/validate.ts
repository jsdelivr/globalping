import type { Schema } from 'joi';
import type { ExtendedMiddleware } from '../../../types.js';

export const validate = (schema: Schema): ExtendedMiddleware => async (ctx, next) => {
	const valid = schema.validate(ctx.request.body, { convert: true, context: ctx.state });

	if (valid.error) {
		const fields = valid.error.details.map(field => [ field.path.join('.'), String(field?.message) ]);

		ctx.status = 400;

		ctx.body = {
			error: {
				type: 'validation_error',
				message: 'Parameter validation failed.',
				params: Object.fromEntries(fields) as never,
			},
			links: {
				documentation: ctx.getDocsLink(),
			},
		};

		return;
	}

	ctx.request.body = valid.value as never;
	await next();
};
