const physicalCpuCount = require('physical-cpu-count');

module.exports = {
	server: {
		processes: physicalCpuCount,
	},
};
