import * as process from 'node:process';

export const errorHandler = async (error: any) => {
	if (process.env['NODE_ENV'] !== 'test') {
		// eslint-disable-next-line node/no-unsupported-features/es-syntax
		const appsignal = await import('../appsignal.js');
		appsignal.default.tracer().setError(error);
	}
};
