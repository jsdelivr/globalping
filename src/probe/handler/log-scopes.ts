import { logScopesSchema } from '../schema/probe-response-schema.js';
import { getProbeLogScopesStorage } from '../log-scopes-storage.js';
import { ProbeValidatorError } from '../../lib/probe-validator.js';
import type { SocketProbe } from '../types.js';

const probeLogScopesStorage = getProbeLogScopesStorage();

export const handleLogScopes = (probe: SocketProbe) => async (scopes: string[]): Promise<void> => {
	const validation = logScopesSchema.validate(scopes);

	if (validation.error) {
		throw validation.error;
	}

	if (!await probeLogScopesStorage.writeScopes(probe.ipAddress, validation.value)) {
		throw new ProbeValidatorError('Probe log scope limit exceeded.');
	}
};
