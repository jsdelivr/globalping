import Koa from 'koa';
import type Router from '@koa/router';
import type { DocsLinkContext } from './lib/http/middleware/docs-link.js';
import type { AuthenticateState } from './lib/http/middleware/authenticate.js';

export type CustomState = Koa.DefaultState & AuthenticateState;
export type CustomContext = Koa.DefaultContext & DocsLinkContext;

export type UnknownNext = () => Promise<unknown>;
export type ExtendedContext = Router.RouterContext<CustomState, CustomContext>;
export type ExtendedMiddleware = Koa.Middleware<CustomState, CustomContext>;
export type ExtendedRouter = Router<CustomState, CustomContext>;

type Inverted<T extends Record<PropertyKey, PropertyKey>> = {
	[P in keyof T as T[P]]: P
};
