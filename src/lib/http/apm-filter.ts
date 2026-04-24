import apmAgent from 'elastic-apm-node';
import { apm as apmUtils } from 'elastic-apm-utils';

apmAgent.addTransactionFilter(apmUtils.transactionFilter({
	keepResponse: [ 'location' ],
}));

apmAgent.addTransactionFilter((payload) => {
	if (!payload['context']) {
		return payload;
	}

	const request = (payload['context'] as { request?: { body?: string; url: URL } }).request;

	// Store only 10% of measurement request bodies.
	if (request?.url.pathname === '/v1/measurements' && request?.body && Math.random() > 0.1) {
		delete request.body;
	}

	return payload;
});

// Filter out short middleware spans.
apmAgent.addSpanFilter((payload) => {
	if (payload['type'] !== 'app' || payload['subtype'] !== 'middleware') {
		return payload;
	}

	if (payload['duration'] > 1) {
		return payload;
	}

	return false;
});

// Filter out short SPUBLISH spans.
apmAgent.addSpanFilter((payload) => {
	if (payload['type'] !== 'db' || payload['subtype'] !== 'redis' || ![ 'SPUBLISH' ].includes(payload['name'] as string)) {
		return payload;
	}

	if (payload['duration'] > 10) {
		return payload;
	}

	return false;
});
