import Koa from 'koa';
import request from 'supertest';
import { discoveryLinks } from '../../../../src/lib/http/middleware/discovery-links.js';

describe('API discovery links middleware', () => {
	const middleware = discoveryLinks({
		apiHost: 'https://api.example.com',
		docsHost: 'https://docs.example.com',
	});

	it('should add API discovery links', async () => {
		const app = new Koa();
		app.use(middleware);

		app.use((ctx) => {
			ctx.body = {};
		});

		await request(app.callback()).get('/v1/test')
			.expect('Link', '<https://api.example.com/v1/spec.yaml>; rel="service-desc"; type="application/yaml", <https://docs.example.com/docs/api.globalping.io>; rel="service-doc"; type="text/html"');
	});

	it('should not add API discovery links to static files', async () => {
		const app = new Koa();
		app.use(middleware);

		app.use((ctx) => {
			ctx.state['isStaticFile'] = true;
			ctx.body = 'static';
		});

		await request(app.callback()).get('/static.txt')
			.expect((response) => {
				if (response.headers['link']) {
					throw new Error(`Unexpected Link header: ${response.headers['link']}`);
				}
			});
	});
});
