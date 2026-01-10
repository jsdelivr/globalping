const physicalCpuCount = require('physical-cpu-count');

module.exports = {
	server: {
		processes: Math.min(physicalCpuCount, 8),
	},
};
