import Joi from 'joi';

// PostgreSQL signed bigint maximum
const MAX_PROBE_LOG_ID = '9223372036854775807';

export type GetProbeLogsQuery = {
	after?: string;
	scopes?: string[];
	search?: string;
};

const scopesSchema = Joi.string().empty('').custom((value: string, helpers) => {
	const scopes = [ ...new Set(value.split(',').map(scope => scope.trim()).filter(Boolean)) ];

	if (scopes.some(scope => scope.length > 64)) {
		return helpers.error('string.max', { limit: 64 });
	}

	return scopes;
});

const afterSchema = Joi.string().pattern(/^\d+$/).custom((value: string, helpers) => {
	const normalized = value.replace(/^0+(?=\d)/, '');

	if (normalized.length > MAX_PROBE_LOG_ID.length
		|| (normalized.length === MAX_PROBE_LOG_ID.length && normalized > MAX_PROBE_LOG_ID)) {
		return helpers.error('any.invalid');
	}

	return value;
});

export const schema = Joi.object<GetProbeLogsQuery>({
	after: afterSchema.optional(),
	scopes: scopesSchema.optional(),
	search: Joi.string().empty('').max(128).optional(),
}).unknown(false);
