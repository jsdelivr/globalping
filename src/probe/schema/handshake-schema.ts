import Joi, { type CustomHelpers } from 'joi';
import config from 'config';
import semver from 'semver';
import { ProbeError } from '../../lib/probe-error.js';

export type HandshakeQuery = {
	version: string;
	nodeVersion: string;
	uuid: string;
	isHardware: boolean;
	hardwareDevice: string | null;
	hardwareDeviceFirmware: string | null;
	adoptionToken: string | null;
	totalMemory: number;
	totalDiskSize: number;
	availableDiskSpace: number;
};

const minProbeVersion = config.get<string>('websocketServer.minProbeVersion');

const versionRangeCheck = (value: string, helpers: CustomHelpers) => {
	if (!semver.satisfies(value, `>=${minProbeVersion}`)) {
		return helpers.error('version.range', { value });
	}

	return value;
};

export const handshakeQuerySchema = Joi.object({
	version: Joi.string().required().custom(versionRangeCheck),
	nodeVersion: Joi.string().pattern(/^v\d+\.\d+\.\d+$/).required(),
	uuid: Joi.string().guid().required(),
	isHardware: Joi.boolean().truthy('1').falsy('0').default(false),
	hardwareDevice: Joi.string().pattern(/^v\d+$/).empty('').default(null),
	hardwareDeviceFirmware: Joi.string().pattern(/^v\d+\.\d+$/).empty('').default(null),
	adoptionToken: Joi.string().empty('').default(null),
	totalMemory: Joi.number().required(),
	totalDiskSize: Joi.number().required(),
	availableDiskSpace: Joi.number().required(),
}).unknown(true).messages({
	'version.range': 'invalid probe version ({#value})',
});

export const parseHandshakeQuery = (query: Record<string, unknown>): HandshakeQuery => {
	const parsedUndefined = Object.fromEntries(Object.entries(query).map(([ key, value ]) => [ key, value === 'undefined' ? undefined : value ]));
	const result = handshakeQuerySchema.validate(parsedUndefined, { convert: true }) as { value: HandshakeQuery; error?: Joi.ValidationError };

	if (result.error) {
		const detail = result.error.details[0]!;

		throw new ProbeError(detail.message);
	}

	return result.value;
};
