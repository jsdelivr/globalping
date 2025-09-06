import type { Schema } from 'joi';
import type { ExtendedMiddleware } from '../../../types.js';

type ValidateOptions = {
	body?: Schema;
	params?: Schema;
	query?: Schema;
};

export const validate = ({ body, params, query }: ValidateOptions): ExtendedMiddleware => async (ctx, next) => {
	const errFields: string[][] = [];

	const validations = [
		{ name: 'body', schema: body, target: ctx.request.body },
		{ name: 'params', schema: params, target: ctx.params },
		{ name: 'query', schema: query, target: ctx.query },
	].filter(validation => validation.schema);

	validations.forEach(({ schema, name, target }) => {
		const result = schema!.validate(target, { convert: true, context: ctx.state });

		if (!result.error) {
			switch (name) {
				case 'body': {
					ctx.request.body = result.value;
					break;
				}

				case 'params': {
					ctx.params = result.value as never;
					break;
				}

				case 'query': {
					ctx.query = result.value as never;
				}
			}

			return;
		}

		errFields.push(...(result.error?.details.map(field => [ field.path.join('.'), String(field?.message) ]) ?? []));
	});

	if (errFields.length) {
		ctx.status = 400;

		ctx.body = {
			error: {
				type: 'validation_error',
				message: 'Parameter validation failed.',
				params: Object.fromEntries(errFields) as never,
			},
			links: {
				documentation: ctx.getDocsLink(),
			},
		};

		return;
	}

	await next();
};
