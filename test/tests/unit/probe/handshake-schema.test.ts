import { expect } from 'chai';
import { parseHandshakeQuery } from '../../../../src/probe/schema/handshake-schema.js';
import { ProbeError } from '../../../../src/lib/probe-error.js';

const expectProbeError = (query: Record<string, unknown>, fieldName: string) => {
	expect(() => parseHandshakeQuery(query)).to.throw(ProbeError, new RegExp(fieldName));
};

describe('parseHandshakeQuery', () => {
	const validQuery = {
		version: '0.39.0',
		nodeVersion: 'v18.17.0',
		totalMemory: '1000000000',
		totalDiskSize: '2000',
		availableDiskSpace: '1000',
		uuid: '11111111-1111-4111-8111-111111111111',
		isHardware: 'undefined',
		hardwareDevice: 'undefined',
		hardwareDeviceFirmware: 'undefined',
		adoptionToken: 'undefined',
	};

	it('parses a valid handshake into a typed object with defaults', () => {
		const result = parseHandshakeQuery({ ...validQuery });

		expect(result).to.deep.equal({
			version: '0.39.0',
			nodeVersion: 'v18.17.0',
			totalMemory: 1000000000,
			totalDiskSize: 2000,
			availableDiskSpace: 1000,
			uuid: '11111111-1111-4111-8111-111111111111',
			isHardware: false,
			hardwareDevice: null,
			hardwareDeviceFirmware: null,
			adoptionToken: null,
		});
	});

	it('rejects required fields sent as literal "undefined"', () => {
		expectProbeError({ ...validQuery, uuid: 'undefined' }, 'uuid');
	});

	describe('version', () => {
		it('rejects an out-of-range version', () => {
			expect(() => parseHandshakeQuery({ ...validQuery, version: '0.38.0' })).to.throw(ProbeError, 'invalid probe version (0.38.0)');
		});

		it('rejects a missing version', () => {
			const { version: _unused, ...rest } = validQuery;
			expectProbeError(rest, 'version');
		});
	});

	describe('nodeVersion', () => {
		it('accepts v-prefixed semver', () => {
			expect(parseHandshakeQuery({ ...validQuery, nodeVersion: 'v20.10.0' }).nodeVersion).to.equal('v20.10.0');
		});

		it('rejects bare semver without v prefix', () => {
			expectProbeError({ ...validQuery, nodeVersion: '18.17.0' }, 'nodeVersion');
		});

		it('rejects invalid semver', () => {
			expectProbeError({ ...validQuery, nodeVersion: 'vNOPE' }, 'nodeVersion');
		});

		it('rejects missing nodeVersion', () => {
			const { nodeVersion: _unused, ...rest } = validQuery;
			expectProbeError(rest, 'nodeVersion');
		});
	});

	describe('uuid', () => {
		it('rejects literal "undefined"', () => {
			expectProbeError({ ...validQuery, uuid: 'undefined' }, 'uuid');
		});

		it('rejects missing uuid', () => {
			const { uuid: _unused, ...rest } = validQuery;
			expectProbeError(rest, 'uuid');
		});

		it('rejects malformed uuid', () => {
			expectProbeError({ ...validQuery, uuid: '1-1-1-1-1' }, 'uuid');
		});
	});

	describe('isHardware', () => {
		it('coerces "true"', () => {
			expect(parseHandshakeQuery({ ...validQuery, isHardware: 'true' }).isHardware).to.equal(true);
		});

		it('coerces "1"', () => {
			expect(parseHandshakeQuery({ ...validQuery, isHardware: '1' }).isHardware).to.equal(true);
		});

		it('coerces "0"', () => {
			expect(parseHandshakeQuery({ ...validQuery, isHardware: '0' }).isHardware).to.equal(false);
		});

		it('defaults to false when missing', () => {
			expect(parseHandshakeQuery({ ...validQuery }).isHardware).to.equal(false);
		});
	});

	describe('hardwareDevice', () => {
		it('accepts v\\d+', () => {
			expect(parseHandshakeQuery({ ...validQuery, hardwareDevice: 'v1' }).hardwareDevice).to.equal('v1');
		});

		it('defaults to null when empty', () => {
			expect(parseHandshakeQuery({ ...validQuery, hardwareDevice: '' }).hardwareDevice).to.equal(null);
		});

		it('defaults to null when missing', () => {
			expect(parseHandshakeQuery({ ...validQuery }).hardwareDevice).to.equal(null);
		});

		it('rejects v with no digits', () => {
			expectProbeError({ ...validQuery, hardwareDevice: 'v' }, 'hardwareDevice');
		});

		it('rejects values with two components', () => {
			expectProbeError({ ...validQuery, hardwareDevice: 'v1.0' }, 'hardwareDevice');
		});
	});

	describe('hardwareDeviceFirmware', () => {
		it('accepts v\\d+\\.\\d+', () => {
			expect(parseHandshakeQuery({ ...validQuery, hardwareDeviceFirmware: 'v2.4' }).hardwareDeviceFirmware).to.equal('v2.4');
		});

		it('defaults to null when empty', () => {
			expect(parseHandshakeQuery({ ...validQuery, hardwareDeviceFirmware: '' }).hardwareDeviceFirmware).to.equal(null);
		});

		it('defaults to null when missing', () => {
			expect(parseHandshakeQuery({ ...validQuery }).hardwareDeviceFirmware).to.equal(null);
		});

		it('rejects values without a minor', () => {
			expectProbeError({ ...validQuery, hardwareDeviceFirmware: 'v2' }, 'hardwareDeviceFirmware');
		});

		it('rejects values with three components', () => {
			expectProbeError({ ...validQuery, hardwareDeviceFirmware: 'v2.4.1' }, 'hardwareDeviceFirmware');
		});
	});

	describe('adoptionToken', () => {
		it('passes valid tokens through', () => {
			expect(parseHandshakeQuery({ ...validQuery, adoptionToken: 'abc123' }).adoptionToken).to.equal('abc123');
		});

		it('defaults to null when empty', () => {
			expect(parseHandshakeQuery({ ...validQuery, adoptionToken: '' }).adoptionToken).to.equal(null);
		});

		it('defaults to null when missing', () => {
			expect(parseHandshakeQuery({ ...validQuery }).adoptionToken).to.equal(null);
		});
	});

	describe('numeric fields', () => {
		it('coerces string numbers to numbers', () => {
			const result = parseHandshakeQuery({ ...validQuery, totalMemory: '500', totalDiskSize: '300', availableDiskSpace: '100' });
			expect(result.totalMemory).to.equal(500);
			expect(result.totalDiskSize).to.equal(300);
			expect(result.availableDiskSpace).to.equal(100);
		});

		it('rejects non-numeric totalMemory', () => {
			expectProbeError({ ...validQuery, totalMemory: 'abc' }, 'totalMemory');
		});

		it('rejects missing totalMemory', () => {
			const { totalMemory: _unused, ...rest } = validQuery;
			expectProbeError(rest, 'totalMemory');
		});
	});
});
