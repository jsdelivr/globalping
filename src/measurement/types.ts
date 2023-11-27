import type { Location } from '../lib/location/types.js';

/**
 * Network Tests
 */

type TestResult = {
	rawOutput: string;
	status: 'in-progress' | 'finished' | 'failed';
};

type PingTest = {
	packets: number;
};

type PingTiming = {
	rtt: number;
	ttl: number;
};

type PingResult = TestResult & {
	timings: PingTiming[];
	stats: {
		min: number;
		avg: number;
		max: number;
		stddev: number;
		packetLoss: number;
	};
};

type TracerouteTest = {
	protocol: 'ICMP' | 'TCP' | 'UDP';
	port: number;
};

type TraceHopTiming = {
	rtt: number;
};

type TraceHopResult = {
	resolvedHostname: string;
	resolvedAddress: string;
	timings: TraceHopTiming[];
};

type TracerouteResult = TestResult & {
	resolvedHostname: string;
	resolvedAddress: string;
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
	query: {
		type: DnsQueryTypes;
	};
	resolver: string;
	protocol: 'TCP' | 'UDP';
	port: number;
	trace: boolean;
};

type DnsAnswer = {
	name: string;
	type: DnsQueryTypes;
	ttl: number;
	class: string;
	value: string;
};

type DnsRegularResult = {
	answers: DnsAnswer[];
	timings: {
		total: number;
	};
	resolver: string;
};

type DnsTraceResult = {
	hops: DnsRegularResult;
};

type DnsResult = TestResult & (DnsRegularResult | DnsTraceResult);

type HttpTest = {
	request: {
		method: 'HEAD' | 'GET';
		host?: string;
		path: string;
		query: string;
		headers: Record<string, string>;
	};
	port?: number;
	protocol: 'HTTPS' | 'HTTP' | 'HTTP2';
	resolver?: string;
};

type HttpProgress = TestProgress & {
	rawHeaders?: string;
	rawBody?: string;
};

type HttpResult = TestResult & {
	resolvedAddress: string;
	headers: Record<string, string>;
	rawHeaders: string;
	rawBody: string;
	truncated: boolean;
	statusCode: number;
	timings: Record<string, number>;
	tls: {
		[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
		authorized: boolean;
		authorizationError?: string;
		createdAt: string;
		expiresAt: string;
		issuer: Record<string, string>;
		subject: Record<string, string>;
	};
};

type TestProgress = {
	rawOutput: string;
};

export type RequestType = 'ping' | 'traceroute' | 'dns' | 'http' | 'mtr';

export type MeasurementOptions = PingTest | TracerouteTest | MtrTest | DnsTest | HttpTest;
export type LocationWithLimit = Location & {limit?: number};

/**
 * Measurement Objects
 */

type MeasurementStatus = 'in-progress' | 'finished';

export type MeasurementRequest = {
	type: 'ping' | 'traceroute' | 'dns' | 'http' | 'mtr';
	target: string;
	measurementOptions: MeasurementOptions;
	locations: LocationWithLimit[];
	limit: number;
	inProgressUpdates: boolean;
};

export type MeasurementResult = {
	probe: {
		continent: string;
		region: string;
		country: string;
		state: string | null; // eslint-disable-line @typescript-eslint/ban-types
		city: string;
		asn: number;
		longitude: number;
		latitude: number;
		network: string;
		tags: string[];
		resolvers: string[];
	};
	result: PingResult | TracerouteResult | DnsResult | MtrResult | HttpResult;
};

export type MeasurementRecord = {
	id: string;
	type: MeasurementRequest['type'];
	status: MeasurementStatus;
	createdAt: string;
	updatedAt: string;
	target: string;
	limit: number;
	probesCount: number;
	locations: LocationWithLimit[];
	measurementOptions?: MeasurementOptions;
	results: MeasurementResult[];
};

/**
 * Probe Messages
 */
export type MeasurementAckMessage = {
	id: string;
	measurementId: string;
};

export type MeasurementProgressMessage = {
	testId: string;
	measurementId: string;
	overwrite?: boolean;
	result: TestProgress | HttpProgress
};

export type MeasurementResultMessage = {
	testId: string;
	measurementId: string;
	overwrite?: boolean;
	result: PingResult | TracerouteResult | DnsResult | MtrResult | HttpResult;
};
