// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// cant be bothered with TS stupidity

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import type {Context, Next} from 'koa';
// Console.log(process.pid)

const appendToFile = (testName: string, data: Record<string, any>) => {
	const filePath = path.resolve(`./benchmark/readings/${testName}-output.json`);
	let oldData = [];

	if (fs.existsSync(filePath)) {
		oldData = JSON.parse(fs.readFileSync(filePath).toString()) as never;
	}

	const fileContent = JSON.stringify([
		...oldData as never,
		data,
	]);

	fs.writeFileSync(filePath, fileContent);
};

export const benchmark = () => async (ctx: Context, next: Next) => {
	const testName = ctx.request.query.test;

	if (!testName) {
		return next();
	}

	const preTime = Date.now();
	const preCpuUsage = process.cpuUsage();

	const memUsageArray = [
		process.memoryUsage(),
	];
	const memUsageInterval = setInterval(() => {
		memUsageArray.push(process.memoryUsage());
	}, 10);

	return next().then(async () => {
		clearInterval(memUsageInterval);

		const postCpuUsage = process.cpuUsage(preCpuUsage);

		const postTime = Date.now();
		const timeDiff = postTime - preTime;

		const memAvgObject: Record<string, number> = {};
		for (const key of Object.keys(memUsageArray[0])) {
			memAvgObject[key] = (memUsageArray.reduce((a: number, b: Record<string, number>) => a + Number(b[key]), 0) / memUsageArray.length);
		}

		appendToFile(testName, {
			request: {
				path: ctx.request.path,
				method: ctx.request.method,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				body: ctx.request.body,
			},
			memory: memAvgObject,
			cpu: postCpuUsage,
			time: timeDiff / 1000,
		});
	});
};
