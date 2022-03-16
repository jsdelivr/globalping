import type {DefaultContext, DefaultState, ParameterizedContext} from 'koa';
import type Router from '@koa/router';
import {getProbeRouter} from '../router.js';
import type {Probe} from '../types.js';

const pRouter = getProbeRouter();

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>) => {
	const probeList = (await pRouter.findMatchingProbes([]));

	ctx.body = probeList.map((probe: Probe) => probe.location);
};

export const registerGetProbesRoute = (router: Router) => {
	router.get('/probes', handle);
};
