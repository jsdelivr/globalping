import type Koa from 'koa';
import type Router from '@koa/router';
import type { DocsLinkContext } from './lib/http/middleware/docs-link.js';
import type { AuthenticateState } from './lib/http/middleware/authenticate.js';
import type { CompressedContext } from './lib/http/middleware/compressed.js';

export type CustomState = Koa.DefaultState & AuthenticateState;
export type CustomContext = Koa.DefaultContext & DocsLinkContext & CompressedContext;

export type UnknownNext = () => Promise<unknown>;
export type ExtendedContext = Router.RouterContext<CustomState, CustomContext>;
export type ExtendedMiddleware = Koa.Middleware<CustomState, CustomContext>;
export type ExtendedRouter = Router<CustomState, CustomContext>;

export type Inverted<T extends Record<PropertyKey, PropertyKey>> = {
	[P in keyof T as T[P]]: P
};
