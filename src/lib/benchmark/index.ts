// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// cant be bothered with TS stupidity

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
// Console.log(process.pid)

let interval: unknown;
let writeStream: unknown;

export const benchmark = () => {
	const cpuUsage = process.cpuUsage();
	const memUsage = process.memoryUsage();

	const date = new Date();

	const result = {
		type: 'benchmark',
		action: 'report',
		mem: memUsage,
		cpu: cpuUsage,
	};

	recordOnBenchmark(result);
};

export const recordOnBenchmark = (input: unknown) => {
	const date = Date.now();
	const string_ = JSON.stringify({...input, date});
	writeStream.write(`${string_}\n`);
};

export const start = () => {
	const date = new Date();
	const dateString = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
	const prefix = process.env.TEST ? `${process.env.TEST}-` : '';
	const filename = `${prefix}${dateString}-idle.log`;
	writeStream = fs.createWriteStream(path.resolve(`./benchmark/readings/${filename}`));
	interval = setInterval(() => {
		benchmark();
	}, 1);
};

export const end = () => {
	writeStream.end();
	clearInterval(interval);
};
