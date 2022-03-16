import type {Probe} from '../probe/types.js';
import type {Location} from '../lib/location/types.js';

/**
 * Network Tests
 */

type TestResult = {
	rawOutput: string;
};

type PingTest = {
	type: 'ping';
	target: string;
	packets: number;
};

type PingResult = TestResult & {
	min: number;
	avg: number;
	max: number;
	stddev: number;
	packetLoss: number;
};

type TracerouteTest = {
	type: 'traceroute';
	target: string;
	protocol: 'ICMP' | 'TCP' | 'UDP';
	port: number;
};

type TracerouteResult = TestResult & {
	foo: string;
};

export type NetworkTest = PingTest | TracerouteTest;
export type MeasurementResult = PingResult | TracerouteResult;
export type LocationWithLimit = Location & {limit?: number};

/**
 * Measurement Objects
 */

type MeasurementStatus = 'in-progress' | 'finished';

export type MeasurementRequest = {
	measurement: NetworkTest;
	locations: LocationWithLimit[];
	limit?: number;
};

export type MeasurementConfig = {
	id: string;
	measurement: NetworkTest;
	probes: Probe[];
};

export type MeasurementRecord = {
	id: string;
	type: NetworkTest['type'];
	status: MeasurementStatus;
	createdAt: number;
	updatedAt: number;
	results: Record<string, (PingResult | TracerouteResult)>;
};

export type MeasurementResponse = {
	id: string;
	type: NetworkTest['type'];
	status: MeasurementStatus;
	created_at: number;
	updated_at: number;
	results: MeasurementResult[];
};

/**
 * Probe Messages
 */
export type MeasurementResultMessage = {
	testId: string;
	measurementId: string;
	result: MeasurementResult;
};
