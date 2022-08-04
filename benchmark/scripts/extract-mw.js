import process from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import _ from 'lodash';

const testName = process.env.TEST_NAME;

const resolveFile = () => {
	const filePath = path.resolve(`./benchmark/readings/${testName}-output.json`);
	const fileContent = JSON.parse(fs.readFileSync(filePath).toString() ?? '[]');

	return fileContent;
};

const saveResult = data => {
	const filePath = path.resolve(`./benchmark/output/${testName}-output.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, 0, 2));
};

const calculateResult = data => {
	const output = [];

	const grouped = _.groupBy(data, item => JSON.stringify(item.request));

	for (const group of Object.values(grouped)) {
		const stats = {
			request: group[0].request,
			samples: group.length,
			/* eslint-disable unicorn/no-array-reduce */
			memory: Object.keys(group[0].memory).reduce((acc, key) => {
				const min = Math.min(...group.map(item => item.memory[key]));
				const max = Math.max(...group.map(item => item.memory[key]));
				const avg = group.reduce((total, item) => total + item.memory[key], 0) / group.length;

				return {
					...acc,
					min: {
						...acc.min,
						[key]: `${Math.round(min / 1024 / 1024)} MB`,
					},
					max: {
						...acc.max,
						[key]: `${Math.round(max / 1024 / 1024)} MB`,
					},
					avg: {
						...acc.avg,
						[key]: `${Math.round(avg / 1024 / 1024)} MB`,
					},
				};
			}, {}),
			cpu: Object.keys(group[0].cpu).reduce((acc, key) => ({
				...acc,
				min: {
					...acc.min,
					[key]: Math.min(...group.map(item => item.cpu[key])),
				},
				max: {
					...acc.max,
					[key]: Math.max(...group.map(item => item.cpu[key])),
				},
				avg: {
					...acc.avg,
					[key]: group.reduce((total, item) => total + item.cpu[key], 0) / group.length,
				},
			}), {}),
			duration: {
				min: Math.min(...group.map(item => item.time)),
				max: Math.max(...group.map(item => item.time)),
				avg: group.reduce((total, item) => total + item.time, 0) / group.length,
				/* eslint-enable unicorn/no-array-reduce */
			},
		};

		output.push(stats);
	}

	return output;
};

const fileContent = resolveFile();
const result = calculateResult(fileContent);
saveResult(result);
