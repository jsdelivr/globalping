import type {Probe} from '../probe/types.js';
import type {Location} from '../lib/location/types.js';

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
	query?: {
		type: DnsQueryTypes;
	};
	resolver: string;
	protocol: 'TCP' | 'UDP';
	port: number;
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
export type LocationWithLimit = Location & {limit?: number};

/**
 * Measurement Objects
 */

type MeasurementStatus = 'in-progress' | 'finished';

export type MeasurementRequest = {
	type: 'ping' | 'traceroute' | 'dns' | 'http' | 'mtr';
	target: string;
	measurementOptions: NetworkTest;
	locations: LocationWithLimit[];
	limit: number;
};

export type MeasurementConfig = {
	id: string;
	measurementOptions: MeasurementOptions;
	probes: Probe[];
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
	createdAt: number;
	updatedAt: number;
	probesCount: number;
	results: Record<string, MeasurementResult>;
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
	result: PingResult | TracerouteResult | DnsResult | MtrResult | HttpResult;
};
