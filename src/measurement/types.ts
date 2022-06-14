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

type TraceHopResult = {
	host: string;
	resolvedAddress: string;
	rtt: number[];
};
type TracerouteResult = TestResult & {
	destination: string;
	hops: TraceHopResult[];
};

type DnsQueryTypes = 'A' | 'AAAA' | 'ANY' | 'CNAME' | 'DNSKEY' | 'DS' | 'MX' | 'NS' | 'NSEC' | 'PTR' | 'RRSIG' | 'SOA' | 'TXT' | 'SRV';

type DnsTest = {
	type: 'dns';
	target: string;
	query?: {
		type: DnsQueryTypes;
		resolver: string;
		protocol: 'TCP' | 'UDP';
		port: number;
	};
};

type DnsAnswer = {
	domain: string;
	type: DnsQueryTypes;
	ttl: number;
	class: string;
	value: string;
};

// Todo: fix: dns result doesnt have rawOutput value
type DnsResult = TestResult & {
	answer: DnsAnswer[];
	time: number;
	server: string;
};

export type NetworkTest = PingTest | TracerouteTest | DnsTest;
export type MeasurementResult = PingResult | TracerouteResult | DnsResult;
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
	completed?: boolean;
	createdAt: number;
	updatedAt: number;
	results: Record<string, (PingResult | TracerouteResult | DnsResult)>;
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
export type MeasurementAckMessage = {
	id: string;
	measurementId: string;
};

export type MeasurementResultMessage = {
	testId: string;
	measurementId: string;
	result: MeasurementResult;
};
