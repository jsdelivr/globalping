const fs = require('fs');
const path = require('path');
let version;

try {
	// We don't really increment the version so the commit hash is more useful.
	version = fs.readFileSync(path.join(path.resolve(), 'data/LAST_API_COMMIT_HASH.txt'), 'utf8').trim();
} catch {
	version = require('./package.json').version;
}

module.exports = {
	active: process.env.NODE_ENV === 'production',
	serviceName: 'globalping-api',
	serviceVersion: version,
	logLevel: 'fatal',
	centralConfig: false,
	captureExceptions: false,
	captureErrorLogStackTraces: 'always',
	ignoreUrls: [ '/favicon.ico', '/health', '/amp_preconnect_polyfill_404_or_other_error_expected._Do_not_worry_about_it' ],
	transactionSampleRate: 1,
};
