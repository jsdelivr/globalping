import type Koa from 'koa';
import type Router from '@koa/router';
import type { DocsLinkContext } from './lib/http/middleware/docs-link.js';

export type CustomState = Koa.DefaultState;
export type CustomContext = Koa.DefaultContext & DocsLinkContext;
export type ExtendedMiddleware = Router.Middleware<CustomState, CustomContext>;
