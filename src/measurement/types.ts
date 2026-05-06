import type { Location } from '../lib/location/types.js';

/**
 * Network Tests
 */

export type TestResult = {
	rawOutput: string;
	status: 'in-progress' | 'finished' | 'failed' | 'offline';
};

type PingTest = {
	packets: number;
	protocol: 'TCP' | 'ICMP';
	port: number;
	ipVersion: 4 | 6;
};

type PingTiming = {
	rtt: number;
	ttl: number;
};

export type PingResult = TestResult & {
	resolvedAddress?: string | null;
	resolvedHostname?: string | null;
	timings?: PingTiming[];
	stats?: {
		min: number | null;
		max: number | null;
		avg: number | null;
		total: number | null;
		loss: number | null;
		rcv: number | null;
		drop: number | null;
	};
};

type TracerouteTest = {
	protocol: 'ICMP' | 'TCP' | 'UDP';
	port: number;
	ipVersion: 4 | 6;
};

type TraceHopTiming = {
	rtt: number;
};

type TraceHopResult = {
	resolvedHostname: string | null;
	resolvedAddress: string | null;
	timings: TraceHopTiming[];
};

export type TracerouteResult = TestResult & {
	resolvedHostname?: string | null;
	resolvedAddress?: string | null;
	hops?: TraceHopResult[];
};

type MtrTest = {
	protocol: 'ICMP' | 'TCP' | 'UDP';
	packets: number;
	port: number;
	ipVersion: 4 | 6;
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
		loss: number;
		stDev: number;
		jMin: number;
		jMax: number;
		jAvg: number;
	};
	asn: number[];
	timings: MtrResultHopTiming[];
	resolvedAddress: string | null;
	resolvedHostname: string | null;
};

export type MtrResult = TestResult & {
	resolvedAddress?: string | null;
	resolvedHostname?: string | null;
	hops?: MtrResultHop[];
};

type DnsQueryTypes = 'A' | 'AAAA' | 'ANY' | 'CNAME' | 'DNSKEY' | 'DS' | 'HTTPS' | 'MX' | 'NS' | 'NSEC' | 'PTR' | 'RRSIG' | 'SOA' | 'TXT' | 'SRV' | 'SVCB';

type DnsTest = {
	query: {
		type: DnsQueryTypes;
	};
	resolver: string;
	protocol: 'TCP' | 'UDP';
	port: number;
	trace: boolean;
	ipVersion: 4 | 6;
};

type DnsAnswer = {
	name: string | null;
	type: DnsQueryTypes | null;
	ttl: number;
	class: string | null;
	value: string;
};

export type DnsRegularResult = {
	statusCodeName?: string;
	statusCode?: number | null;
	answers?: DnsAnswer[];
	resolver?: string | null;
	timings?: {
		total: number | null;
	};
};

export type DnsTraceResult = {
	hops?: Omit<DnsRegularResult, 'statusCode' | 'statusCodeName'>[];
};

export type DnsResult = TestResult & (DnsRegularResult | DnsTraceResult);

type HttpTest = {
	request: {
		method: 'HEAD' | 'GET' | 'OPTIONS';
		host?: string;
		path: string;
		query: string;
		headers: Record<string, string>;
	};
	port?: number;
	protocol: 'HTTPS' | 'HTTP' | 'HTTP2';
	resolver?: string;
	ipVersion: 4 | 6;
};

export type HttpProgress = TestProgress & {
	rawHeaders?: string;
	rawBody?: string;
};

export type HttpResult = TestResult & {
	resolvedAddress?: string | null;
	headers?: Record<string, string | string[]>;
	rawHeaders?: string | null;
	rawBody?: string | null;
	truncated?: boolean;
	statusCode?: number | null;
	statusCodeName?: string | null;
	timings?: {
		total?: number | null;
		download?: number | null;
		firstByte?: number | null;
		dns?: number | null;
		tls?: number | null;
		tcp?: number | null;
	};
	tls?: {
		authorized: boolean;
		protocol: string;
		cipherName: string;
		createdAt: string;
		expiresAt: string;
		authorizationError?: string;
		subject: Record<string, string>;
		issuer: Record<string, string>;
		keyType: 'RSA' | 'EC' | null;
		keyBits: number | null;
		serialNumber: string;
		fingerprint256: string;
		publicKey: string | null;
	};
};

export type TestProgress = {
	rawOutput: string;
};

export type RequestType = 'ping' | 'traceroute' | 'dns' | 'http' | 'mtr';

export type MeasurementOptions = PingTest | TracerouteTest | MtrTest | DnsTest | HttpTest;
export type LocationWithLimit = Location & { limit?: number };

export type ExportMeta = {
	origin?: string | null;
	userAgent?: string | null;
	userTier?: 'member' | 'sponsor' | 'special' | 'anonymous';
	timeSeriesEnabled?: boolean;
};

/**
 * Measurement Objects
 */

export type UserRequest = Omit<MeasurementRequest, 'locations' | 'limit'> & {
	locations: LocationWithLimit[] | string;
	limit: number;
};

export type MeasurementRequest = {
	type: 'ping' | 'traceroute' | 'dns' | 'http' | 'mtr';
	target: string;
	measurementOptions: MeasurementOptions;
	locations: LocationWithLimit[] | undefined;
	limit: number | undefined;
	inProgressUpdates: boolean;
	scheduleId?: string;
	configurationId?: string;
};

export type MeasurementResult = {
	probe: {
		continent: string;
		region: string;
		country: string;
		state: string | null;
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
	status: 'in-progress' | 'finished';
	createdAt: string;
	updatedAt: string;
	target: string;
	limit?: number;
	probesCount: number;
	locations?: LocationWithLimit[];
	measurementOptions?: MeasurementOptions;
	results: MeasurementResult[];
	scheduleId?: string;
	configurationId?: string;
};

/**
 * Probe Messages
 */

export type MeasurementRequestMessage = {
	testId: string;
	measurementId: string;
	measurement: MeasurementOptions & {
		type: MeasurementRequest['type'];
		target: MeasurementRequest['target'];
		inProgressUpdates: MeasurementRequest['inProgressUpdates'];
	};
};

export type MeasurementProgressMessage = {
	testId: string;
	measurementId: string;
	overwrite?: boolean;
	result: TestProgress | HttpProgress;
};

export type MeasurementResultMessage = {
	testId: string;
	measurementId: string;
	result: PingResult | TracerouteResult | DnsResult | MtrResult | HttpResult;
};
