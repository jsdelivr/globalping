import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createClient, type RedisClientType } from 'redis';

const REDIS_URL = '';
const REDIS_PASSWORD = '';

if (!REDIS_URL || !REDIS_PASSWORD) {
	throw new Error('REDIS_URL and REDIS_PASSWORD must be specified');
}

const STREAM_KEY = 'gp:spl:events';
const LOG_DIR = 'logs';
const ROTATION_INTERVAL = 60 * 60 * 1000;

let currentLogPath = '';
let writeStream: fs.WriteStream | null = null;

const getLogPath = () => path.join(LOG_DIR, `redis-${new Date().toISOString().slice(0, 13).replace(/[T:]/g, '-')}.log`);

const rotateLog = async () => {
	const newLogPath = getLogPath();

	if (newLogPath === currentLogPath) {
		return;
	}

	const oldStream = writeStream;
	const oldPath = currentLogPath;

	currentLogPath = newLogPath;
	writeStream = fs.createWriteStream(newLogPath, { flags: 'a' });

	if (oldStream && oldPath) {
		oldStream.end();
		await new Promise<void>(resolve => oldStream.once('finish', resolve));

		const gzPath = `${oldPath}.gz`;
		const source = fs.createReadStream(oldPath);
		const destination = fs.createWriteStream(gzPath);
		await pipeline(source, zlib.createGzip(), destination);
		fs.unlinkSync(oldPath);
	}
};

const log = async (id: string, message: string, client: RedisClientType) => {
	const ts = new Date(Number(id.split('-')[0])).toISOString();
	const m = JSON.parse(message) as Record<string, string>;
	const nodeId = m['n'];
	let out = `${ts} [${nodeId}]`;

	if (m['r']) {
		out += ` RELOAD:${m['r']}`;
		const nodeData = await client.json.get(`gp:spl:probes:${nodeId}`) as { changeTimestamp: number; revalidateTimestamp: number; probesById: object } | null;

		if (nodeData) {
			out += ` change:${new Date(nodeData.changeTimestamp).toISOString()} revalidate:${new Date(nodeData.revalidateTimestamp).toISOString()} probes:${Object.keys(nodeData.probesById).length}`;
		}
	}

	if (m['a']) { out += ` ALIVE:${new Date(Number(m['a'])).toISOString()}`; }

	if (m['s']) { out += ` STATS:${Object.keys(JSON.parse(m['s']) as object).length}`; }

	if (m['+']) { out += ` UPDATE:${m['+'].split(',').length}`; }

	if (m['-']) { out += ` REMOVE:${m['-'].split(',').length}`; }

	writeStream?.write(out + '\n');
};

const createRedisClient = async () => {
	const client = createClient({
		url: REDIS_URL,
		password: REDIS_PASSWORD,
	});

	client.on('error', err => console.error('Redis error:', err));
	await client.connect();
	return client;
};

const SYNC_INTERVAL = 2000;
let lastId = Date.now().toString();

const syncPull = async (client: RedisClientType) => {
	const events = await client.xRange(STREAM_KEY, lastId, '+');

	if (events[0]?.id === lastId) {
		events.shift();
	}

	for (const entry of events) {
		lastId = entry.id;
		await log(entry.id, JSON.stringify(entry.message), client);
	}
};

const schedulePull = (client: RedisClientType) => {
	setTimeout(() => {
		syncPull(client)
			.finally(() => schedulePull(client))
			.catch(err => console.error('Error in syncPull:', err));
	}, SYNC_INTERVAL);
};

const main = async () => {
	fs.mkdirSync(LOG_DIR, { recursive: true });
	await rotateLog();
	setInterval(() => void rotateLog(), ROTATION_INTERVAL);

	const client = await createRedisClient() as RedisClientType;
	await syncPull(client);
	schedulePull(client);
};

main().catch(console.error);
