import appsignal from '../appsignal.js';

export const errorHandler = async (error: Error) => appsignal.tracer().setError(error);
