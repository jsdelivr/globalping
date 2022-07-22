import type {Probe} from '../probe/types.js';
import type {Location} from '../lib/location/types.js';

/**
 * Network Tests
 */

type TestResult = {
	rawOutput: string;
};

type PingTest = {
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

type MtrTest = {
	protocol: 'ICMP' | 'TCP' | 'UDP';
	packets: number;
	port: number;
};

type MtrResultHopTiming = {
	rtt: number;
};

type MtrResultHop = {
	stats: {
		min: number;
		max: number;
		avg: number;
		total: number;
		rcv: number;
		drop: number;
		stDev: number;
		jMin: number;
		jMax: number;
		jAvg: number;
	};
	asn: number[];
	timings: MtrResultHopTiming[];
	resolvedAddres: string;
	resolvedHostname: string;
	duplicate: boolean;
};

type MtrResult = TestResult & {
	resolvedAddress: string;
	resolvedHostname: string;
	hops: MtrResultHop[];
};

type DnsQueryTypes = 'A' | 'AAAA' | 'ANY' | 'CNAME' | 'DNSKEY' | 'DS' | 'MX' | 'NS' | 'NSEC' | 'PTR' | 'RRSIG' | 'SOA' | 'TXT' | 'SRV';

type DnsTest = {
	query?: {
		type: DnsQueryTypes;
	};
	resolver: string;
	protocol: 'TCP' | 'UDP';
	port: number;
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

type HttpTest = {
	query: {
		method: 'head' | 'get';
		host?: string;
		path?: string;
		headers: Record<string, string>;
	};
	port: number;
	protocol: 'https' | 'http' | 'http2';
	resolver?: string;
};

type HttpResult = TestResult & {
	resolvedAddress: string;
	headers: Record<string, string>;
	rawHeaders: string;
	rawBody: string;
	statusCode: number;
	timings: Record<string, number>;
	tls: {
		[key: string]: any;
		authorized: boolean;
		authorizationError?: string;
		createdAt: string;
		expiresAt: string;
		issuer: Record<string, string>;
		subject: Record<string, string>;
	};
};

export type RequestType = 'ping' | 'traceroute' | 'dns' | 'http' | 'mtr';

export type MeasurementOptions = PingTest | TracerouteTest | MtrTest | DnsTest | HttpTest;
export type NetworkTest = MeasurementOptions & {type: RequestType; target: string};
export type MeasurementResult = PingResult | TracerouteResult | MtrResult | DnsResult | HttpResult;
export type LocationWithLimit = Location & {limit?: number};

/**
 * Measurement Objects
 */

type MeasurementStatus = 'in-progress' | 'finished';

export type MeasurementRequest = {
	type: 'ping' | 'traceroute' | 'dns' | 'http' | 'mtr';
	target: string;
	measurement: NetworkTest;
	locations: LocationWithLimit[];
	limit: number;
};

export type MeasurementConfig = {
	id: string;
	measurement: MeasurementOptions;
	probes: Probe[];
};

export type MeasurementRecord = {
	id: string;
	type: MeasurementRequest['type'];
	status: MeasurementStatus;
	createdAt: number;
	updatedAt: number;
	probesCount: number;
	results: Record<string, (PingResult | TracerouteResult | DnsResult)>;
};

export type MeasurementResponse = {
	id: string;
	type: MeasurementRequest['type'];
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
	overwrite?: boolean;
	result: MeasurementResult;
};
