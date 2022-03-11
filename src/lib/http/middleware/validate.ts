import type {Schema} from 'joi';
import type {Context, Next} from 'koa';

export const validate = (schema: Schema) => async (ctx: Context, next: Next) => {
	const valid = schema.validate(ctx.request.body);

	if (valid.error) {
		ctx.status = 422;
		// Todo: proper error formatting
		ctx.body = valid.error;
		return;
	}

	ctx.request.body = valid.value as never;
	await next();
};
