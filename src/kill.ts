import {getWsServer, initWsServer, PROBES_NAMESPACE} from './lib/ws/server.js';
import cryptoRandomString from 'crypto-random-string';
import {initRedis} from './lib/redis/client.js';

await initRedis();
await initWsServer();

const io = getWsServer();

const spamProbes = async () => {
	const probes = await io.of(PROBES_NAMESPACE).fetchSockets();
	const oldProbes = probes.filter(p => p.data['probe'].version !== '0.5.0');

	if (oldProbes.length === 0) {
		process.exit(0);
	}

	for (const probe of oldProbes) {
		io.of(PROBES_NAMESPACE).to(probe.id).emit('probe:measurement:request', {
			id: cryptoRandomString({type: 'url-safe', length: 16 * 100}),
			measurement: {type: 'unknown'} as any,
		});
	}

	spamProbes();
}

spamProbes();
