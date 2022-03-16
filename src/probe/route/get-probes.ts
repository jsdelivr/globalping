import type {DefaultContext, DefaultState, ParameterizedContext} from 'koa';
import type Router from '@koa/router';
import {getProbeRouter} from '../router.js';
import type {Probe} from '../types.js';
import type {LocationWithLimit} from '../../measurement/types.js';

const probeRouter = getProbeRouter();

const handleAll = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>) => {
	const probeList = (await probeRouter.findMatchingProbes([]));

	ctx.body = probeList.map((probe: Probe) => probe.location);
};

const handleCountry = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>) => {
	const {country} = ctx.params;

	const location: LocationWithLimit[] = [{type: 'country', value: country!}];

	const probeList = (await probeRouter.findMatchingProbes(location));

	ctx.body = probeList.map((probe: Probe) => probe.location);
};

const handle = async (ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext>) => {
	if (ctx.params['country']) {
		return handleCountry(ctx);
	}

	return handleAll(ctx);
};

export const registerGetProbesRoute = (router: Router) => {
	router.get('/probes', handle);
	router.get('/probes/:country([A-Z]{2})', handle);
};
