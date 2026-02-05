import config from 'config';
import { timeSeriesClient } from '../lib/sql/client.js';
import { MeasurementResult, HttpResult, DnsRegularResult, DnsResult } from '../measurement/types.js';

const DNS_TIMEOUT = config.get<number>('measurement.timeSeries.dnsTimeout');
const HTTP_TIMEOUT = config.get<number>('measurement.timeSeries.httpTimeout');

export type TimeSeriesDnsRecord = {
	measurementId: string;
	testId: string;
	configurationId: string;
	probe: MeasurementResult['probe'];
	result: DnsResult & DnsRegularResult;
};

export type TimeSeriesHttpRecord = {
	measurementId: string;
	testId: string;
	configurationId: string;
	probe: MeasurementResult['probe'];
	result: HttpResult;
};

type CommonFields = ReturnType<typeof mapCommonFields>;

type DnsRow = CommonFields & {
	resolver: string | null;
	up: boolean;
	total: number | null;
};

type HttpRow = CommonFields & {
	resolvedAddress: string | null;
	up: boolean;
	total: number | null;
	download: number | null;
	firstByte: number | null;
	dns: number | null;
	tls: number | null;
	tcp: number | null;
};

const mapCommonFields = (row: TimeSeriesHttpRecord | TimeSeriesDnsRecord) => ({
	measurementId: row.measurementId,
	testId: row.testId,
	createdAt: timeSeriesClient.fn.now(),
	configurationId: row.configurationId,
	continent: row.probe.continent,
	country: row.probe.country,
	state: row.probe.state,
	city: row.probe.city,
	// eslint-disable-next-line no-bitwise
	asn: row.probe.asn >> 0,
	latitude: row.probe.latitude,
	longitude: row.probe.longitude,
	network: row.probe.network,
});


export const writeDnsRecords = async (records: TimeSeriesDnsRecord[]) => {
	const failedRows: CommonFields[] = [];
	const successfulRows: DnsRow[] = [];

	records.forEach((record) => {
		const commonFields = mapCommonFields(record);

		if (record.result.rawOutput.includes('measurement timed out')) {
			failedRows.push(commonFields);
		} else {
			successfulRows.push({
				...commonFields,
				resolver: record.result.resolver ?? null,
				up: record.result.status === 'finished' && (record.result.timings?.total ?? Infinity) <= DNS_TIMEOUT,
				total: record.result.timings?.total ?? null,
			});
		}
	});

	const promises: Promise<unknown>[] = [];

	if (successfulRows.length > 0) {
		promises.push(timeSeriesClient('test_dns').insert(successfulRows));
	}

	if (failedRows.length > 0) {
		promises.push(timeSeriesClient('test_dns_failed').insert(failedRows));
	}

	await Promise.all(promises);
};

export const writeHttpRecords = async (records: TimeSeriesHttpRecord[]) => {
	const failedRows: CommonFields[] = [];
	const successfulRows: HttpRow[] = [];

	records.forEach((record) => {
		const commonFields = mapCommonFields(record);

		if (record.result.rawOutput.includes('measurement timed out')) {
			failedRows.push(commonFields);
		} else {
			successfulRows.push({
				...commonFields,
				resolvedAddress: record.result.resolvedAddress ?? null,
				up: record.result.status === 'finished' && (record.result.timings?.total ?? Infinity) <= HTTP_TIMEOUT,
				total: record.result.timings?.total ?? null,
				download: record.result.timings?.download ?? null,
				firstByte: record.result.timings?.firstByte ?? null,
				dns: record.result.timings?.dns ?? null,
				tls: record.result.timings?.tls ?? null,
				tcp: record.result.timings?.tcp ?? null,
			});
		}
	});

	const promises: Promise<unknown>[] = [];

	if (successfulRows.length > 0) {
		promises.push(timeSeriesClient('test_http').insert(successfulRows));
	}

	if (failedRows.length > 0) {
		promises.push(timeSeriesClient('test_http_failed').insert(failedRows));
	}

	await Promise.all(promises);
};
