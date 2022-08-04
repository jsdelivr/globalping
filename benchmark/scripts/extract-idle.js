import process from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import _ from 'lodash';

const testName = process.env.TEST_NAME;

const resolveFile = () => {
	const filePath = path.resolve(`./benchmark/readings/${testName}-idle.log`);
	return fs.readFileSync(filePath).toString().split('\n').filter(Boolean).map(l => JSON.parse(l));
};

const saveResult = data => {
	const filePath = path.resolve(`./benchmark/output/${testName}-idle.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, 0, 2));
};

const calcPerGroup = (data, duration) => {
	let durationObject = {};

	if (duration) {
		durationObject = {
			min: `${Math.min(...duration)} ms`,
			max: `${Math.max(...duration)} ms`,

			avg: `${duration.reduce((total, item) => total + item, 0) / duration.length} ms`,
		};
	}

	return {
		samples: data.length,
		// eslint-disable-next-line unicorn/no-array-reduce
		memory: Object.keys(data[0].mem).reduce((acc, key) => {
			const min = Math.min(...data.map(item => item.mem[key]));
			const max = Math.max(...data.map(item => item.mem[key]));

			const avg = data.reduce((total, item) => total + item.mem[key], 0) / data.length;

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
		// eslint-disable-next-line unicorn/no-array-reduce
		cpu: Object.keys(data[0].cpu).reduce((acc, key) => ({
			...acc,
			min: {
				...acc.min,
				[key]: Math.min(...data.map(item => item.cpu[key])),
			},
			max: {
				...acc.max,
				[key]: Math.max(...data.map(item => item.cpu[key])),
			},
			avg: {
				...acc.avg,

				[key]: Math.round(data.reduce((total, item) => total + item.cpu[key], 0) / data.length),
			},
		}), {}),
		...(duration ? {duration: durationObject} : {}),
	};
};

const calculateResult = data => {
	const output = {};

	// Total duration
	const bReadings = data.filter(l => l.type === 'benchmark' && l.action === 'report');
	output.total = calcPerGroup(bReadings);

	// Start indexes
	const startIndexList = data.filter(l => l.action === 'start');
	// eslint-disable-next-line unicorn/no-array-reduce
	const testGroups = startIndexList.reduce((acc, entry) => {
		const startEntryIndex = data.findIndex(l => l.id === entry.id && l.action === 'start');
		const endEntryIndex = data.findIndex(l => l.id === entry.id && l.action === 'end');

		if (endEntryIndex === -1) {
			return acc;
		}

		const group = data.slice(startEntryIndex, endEntryIndex).filter(l => l.type === 'benchmark' && l.action === 'report');
		const duration = data[endEntryIndex].date - data[startEntryIndex].date;

		return {
			...acc,
			[entry.id]: {
				type: entry.type,
				data: group,
				duration,
			},
		};
	}, {});

	// eslint-disable-next-line unicorn/no-array-reduce
	const individualActions = Object.keys(testGroups).reduce((acc, key) => {
		const item = testGroups[key];
		return {
			...acc,
			[key]: {
				type: item.type,
				duration: item.duration,
				data: calcPerGroup(item.data),
			},
		};
	}, {});

	// eslint-disable-next-line unicorn/no-array-reduce
	const totalActions = Object.values(_.groupBy(testGroups, 'type')).reduce((acc, entry) => {
		const group = entry.map(g => g.data);
		const duration = entry.map(g => g.duration);

		return {
			...acc,
			[entry[0].type]: calcPerGroup(group.flat(), duration),
		};
	}, {});

	output.actions = {
		total: totalActions,
		individual: individualActions,
	};

	return output;
};

const fileContent = resolveFile();
const result = calculateResult(fileContent);
saveResult(result);
