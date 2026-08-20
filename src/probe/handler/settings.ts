import { settingsSchema } from '../schema/probe-response-schema.js';
import type { ProbeSettings, SocketProbe } from '../types.js';

export const handleSettingsUpdate = (probe: SocketProbe) => (settings: ProbeSettings): void => {
	const validation = settingsSchema.validate(settings);

	if (validation.error) {
		throw validation.error;
	}

	probe.settings = validation.value;
};
