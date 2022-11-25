/* eslint-disable no-await-in-loop */

import {execSync} from 'node:child_process';
import fs from 'node:fs';

// Config

const config = {
	host: 'https://api.globalping.io/v1',
	delay: 300, // Time to wait between measurements
	measurements: [
		{probes: 100, rps: 1, duration: 240},
		{probes: 100, rps: 2, duration: 240},
		{probes: 100, rps: 5, duration: 240},
	],
};

// Types

interface JsonResult {
	aggregate: {
		counters: {
			'http.requests': number;
			'http.codes.202': number;
			'http.codes.400': number;
			'vusers.failed': 0;
		};
		summaries: {
			'http.response_time': {
				min: number;
				max: number;
				count: number;
				p50: number;
				median: number;
				p75: number;
				p90: number;
				p95: number;
				p99: number;
				p999: number;
			};
		};
	};
}

interface Measurement {
	requests: {
		sent: number;
		codes202: number;
		codes400: number;
		totalFailed: number;
	};
	timings: {
		min: number;
		median: number;
		max: number;
	};
}

// Utils

const wait = secs => new Promise(resolve => {
	setTimeout(resolve, secs * 1000);
});

const clearDirs = () => {
	const dirs = ['test-perf/jsons', 'test-perf/htmls'];
	for (const dir of dirs) {
		fs.rmSync(dir, {recursive: true, force: true});
		fs.mkdirSync(dir);
	}
};

const measure = (probes: number, rps: number, duration: number) => {
	const name = `${probes}-probes-${rps}-rps-${duration}-duration`;
	execSync(`HOST=${config.host} DURATION=${duration} RPS=${rps} LIMIT=${probes} artillery run -o test-perf/jsons/${name}.json test-perf/artillery.yml`, {stdio: 'inherit'});
	execSync(`artillery report -o test-perf/htmls/${name}.html test-perf/jsons/${name}.json`, {stdio: 'inherit'});
};

const readResults = async (fileName: string): Promise<Measurement> => {
	// eslint-disable-next-line node/no-unsupported-features/es-syntax
	const json = await import(`./jsons/${fileName}`, {assert: {type: 'json'}}).then(module => module.default as JsonResult);
	const requests = {
		sent: json.aggregate.counters['http.requests'] || 0,
		codes202: json.aggregate.counters['http.codes.202'] || 0,
		codes400: json.aggregate.counters['http.codes.400'] || 0,
		totalFailed: json.aggregate.counters['vusers.failed'] || 0,
	};
	const timings = {
		min: json.aggregate.summaries['http.response_time'].min,
		median: json.aggregate.summaries['http.response_time'].median,
		max: json.aggregate.summaries['http.response_time'].max,
	};
	return {
		requests,
		timings,
	};
};

const getResultsFromJsons = async () => {
	const fileNames = fs.readdirSync('test-perf/jsons');
	const results: Record<string, Measurement> = {};
	for (const fileName of fileNames) {
		const result = await readResults(fileName);
		results[fileName.slice(0, -5)] = result;
	}

	return results;
};

const generateCsv = (results: Record<string, Measurement>, startDate: string) => {
	let resultString = 'Measurement,N of Requests,N of 202,N of 400,N of Errors,min T,median T,max T\n';
	// eslint-disable-next-line guard-for-in
	for (const name in results) {
		const result = results[name];
		resultString += name + ',' + Object.values(result.requests).join(',') + ',' + Object.values(result.timings).join(',') + '\n';
	}

	fs.writeFileSync(`result-${startDate}.csv`, resultString);
};

// Run

const run = async () => {
	const startDate = new Date().toISOString();
	console.log('MEASUREMENTS START', startDate);

	clearDirs();

	for (const {probes, rps, duration} of config.measurements) {
		measure(probes, rps, duration);
		const results = await getResultsFromJsons();
		generateCsv(results, startDate);
		console.log(`PAUSING FOR ${config.delay} SECS`);
		await wait(config.delay);
	}

	console.log('MEASUREMENTS END', new Date().toISOString());
};

await run();
