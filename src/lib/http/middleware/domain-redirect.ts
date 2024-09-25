import type { Context, Next } from 'koa';

const domainRedirect = () => (ctx: Context, next: Next) => {
	if (ctx.host === 'globalping.io') {
		ctx.status = 301;
		ctx.redirect(`https://jsdelivr.com/globalping${ctx.path !== '/' ? ctx.url : ctx.url.substring(1)}`);
		return;
	}

	return next();
};

export default domainRedirect;
