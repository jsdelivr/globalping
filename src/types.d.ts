import type Koa from 'koa';
import type Router from '@koa/router';
import type { DocsLinkContext } from './lib/http/middleware/docs-link.js';

export type CustomState = Koa.DefaultState & { userId?: string };
export type CustomContext = Koa.DefaultContext & DocsLinkContext;

export type ExtendedContext = Router.RouterContext<CustomState, CustomContext>;
export type ExtendedMiddleware = Router.Middleware<CustomState, CustomContext>;
