import _ from 'lodash';
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import TTLCache from '@isaacs/ttlcache';
import { scopedLogger } from '../logger.js';
import type { WsServerNamespace } from './server.js';
import type { Probe, ProbeStats } from '../../probe/types.js';
import type winston from 'winston';
import type { ProbeOverride } from '../probe-override.js';
import type { RedisClient } from '../redis/shared.js';

type NodeData = {
	nodeId: string;
	changeTimestamp: number;
	revalidateTimestamp: number;
	probesById: Record<string, Probe>;
};

type NodeChanges = {
	nodeId: string;
	reloadNode: boolean;
	revalidateTimestamp: number | undefined;
	removeProbes: Set<string>;
	updateProbes: Set<string>;
	updateStats: Map<string, ProbeStats>;
};

const MESSAGE_TYPES = {
	ALIVE: 'a',
	META: 'm',
	NODE: 'n',
	UPDATE: '+',
	RELOAD: 'r',
	REMOVE: '-',
	STATS: 's',
};

export class SyncedProbeList extends EventEmitter {
	remoteDataTtl = 60 * 60 * 1000;
	syncInterval = 2000;
	syncTimeout = 5000;

	readonly localUpdateEvent = 'spl:local-update';
	readonly remoteEventsStream = 'gp:spl:events';

	private logger: winston.Logger;
	private rawProbes: Probe[];
	private probesWithAdminData: Probe[];
	private probes: Probe[];
	private oldest: number;
	private pushTimer: NodeJS.Timeout | undefined;
	private pullTimer: NodeJS.Timeout | undefined;
	private lastReadEventId: string;

	private readonly nodeId: string;
	private readonly nodeData: TTLCache<string, NodeData>;

	constructor (private readonly redis: RedisClient, private readonly ioNamespace: WsServerNamespace, private readonly probeOverride: ProbeOverride) {
		super();
		this.nodeId = randomBytes(8).toString('hex');
		this.logger = scopedLogger('synced-probe-list', this.nodeId);
		this.rawProbes = [];
		this.probesWithAdminData = [];
		this.probes = [];
		this.oldest = Infinity;
		this.lastReadEventId = Date.now().toString();

		this.nodeData = new TTLCache<string, NodeData>({
			noDisposeOnSet: true,
			dispose: (nodeData) => {
				this.logger.info(`Removed node ${nodeData.nodeId}.`);
				this.updateProbes();
			},
		});
	}

	getRawProbes (): Probe[] {
		return this.rawProbes.slice();
	}

	getProbesWithAdminData (): Probe[] {
		return this.probesWithAdminData.slice();
	}

	getProbes (): Probe[] {
		return this.probes.slice();
	}

	async fetchProbes (): Promise<Probe[]> {
		const start = Date.now();

		return new Promise((resolve) => {
			const checker = () => {
				if (this.oldest > start) {
					resolve(this.probes.slice());
					this.off(this.localUpdateEvent, checker);
				}
			};

			this.on(this.localUpdateEvent, checker);
		});
	}

	private updateProbes () {
		const probes = [];
		let oldest = Infinity;

		for (const nodeData of this.nodeData.values()) {
			probes.push(...Object.values(nodeData.probesById));

			if (nodeData.revalidateTimestamp < oldest) {
				oldest = nodeData.revalidateTimestamp;
			}
		}

		this.rawProbes = probes;
		this.probesWithAdminData = this.probeOverride.addAdminData(probes);
		this.probes = this.probeOverride.addAdoptedData(this.probesWithAdminData);
		this.oldest = oldest;

		this.emit(this.localUpdateEvent);
	}

	private handleUpdate (message: NodeData) {
		if (message.nodeId !== this.nodeId && !this.nodeData.has(message.nodeId)) {
			this.logger.info(`Registered new node ${message.nodeId}.`);
		}

		this.nodeData.set(message.nodeId, message, { ttl: this.syncTimeout });
		this.updateProbes();
	}

	private getRemoteDataKey (nodeId: string) {
		return `gp:spl:probes:${nodeId}`;
	}

	private getRemoteNodeData (nodeId: string): Promise<NodeData | null> {
		return this.redis.json.get(this.getRemoteDataKey(nodeId)) as Promise<NodeData | null>;
	}

	private getRemoteNodeDataAtPath<T> (nodeId: string, path: string): Promise<T | null> {
		return this.redis.json.get(this.getRemoteDataKey(nodeId), { path }).then((result) => {
			if (Array.isArray(result)) {
				return result[0];
			}

			return result;
		}) as Promise<T | null>;
	}

	private getRemoteNodeDataAtPaths<T> (nodeId: string, path: string[]): Promise<Array<T | null>> {
		return this.redis.json.get(this.getRemoteDataKey(nodeId), { path }).then((result) => {
			// Normalize redis variable return format.
			if (result) {
				return path.length > 1
					? Object.values(result as unknown as Record<string, T[]>).map(v => v[0])
					: [ (result as unknown as T[])[0] ];
			}

			return result;
		}) as unknown as Promise<Array<T | null>>;
	}

	private setRemoteNodeData (nodeId: string, nodeData: NodeData): Promise<unknown> {
		const nodeKey = this.getRemoteDataKey(nodeId);

		return Promise.all([
			this.redis.json.set(nodeKey, '$', nodeData),
			this.redis.pExpire(nodeKey, this.remoteDataTtl),
		]);
	}

	private publishEvent (message: Record<string, string>): Promise<string> {
		return this.redis.xAdd(this.remoteEventsStream, '*', {
			...message,
			[MESSAGE_TYPES.NODE]: this.nodeId,
		}, {
			TRIM: {
				strategy: 'MAXLEN',
				strategyModifier: '~',
				threshold: 100,
			},
		});
	}

	private serializeProbeStats (stats: ProbeStats): string {
		const loadStats = stats.cpu.load.flatMap(load => [ load.idle, load.usage ]);
		return [ stats.jobs.count ].concat(loadStats).join();
	}

	private unserializeProbeStats (statsString: string): ProbeStats {
		const parts = statsString.split(',').map(Number);

		return {
			jobs: {
				count: parts[0] || 0,
			},
			cpu: {
				count: Math.floor(parts.length / 2),
				load: parts.slice(1).reduce((acc, v, i, a) => {
					return acc.concat([{ idle: v, usage: a[i + 1] || 0 }]);
				}, [] as ProbeStats['cpu']['load']),
			},
		};
	}

	async syncPush () {
		const sockets = await this.ioNamespace.local.fetchSockets();
		const currentProbes = sockets.map(socket => _.cloneDeep(socket.data.probe));
		const previousNodeData = this.nodeData.get(this.nodeId);

		const nodeData = {
			nodeId: this.nodeId,
			changeTimestamp: Date.now(),
			revalidateTimestamp: Date.now(),
			probesById: Object.fromEntries(currentProbes.map(probe => [ probe.client, probe ])),
		};

		const previousTimestamp = previousNodeData?.changeTimestamp;
		const remoteTimestamp = await this.getRemoteNodeDataAtPath<number>(this.nodeId, '$.changeTimestamp');

		// If timestamps don't match (shouldn't happen unless the DB is flushed/key evicted),
		// we reset the data and tell all nodes to do a full reload...
		if (!remoteTimestamp || remoteTimestamp !== previousTimestamp) {
			this.handleUpdate(nodeData);
			await this.setRemoteNodeData(this.nodeId, nodeData);
			await this.publishEvent({ [MESSAGE_TYPES.RELOAD]: '1' });
			return;
		}

		const previousProbes = previousNodeData?.probesById || {};
		const previousProbesMap = new Map(Object.entries(previousProbes));
		const updatedStatsById: Record<string, string> = {};
		const updatedProbesIds = [];

		// ...otherwise we compute a diff.
		for (const currentProbe of currentProbes) {
			const previousProbe = previousProbesMap.get(currentProbe.client);
			previousProbesMap.delete(currentProbe.client);

			const probesEqualExceptStats = _.isEqualWith(currentProbe, previousProbe, (a, b, key) => {
				if (key === 'stats') {
					if (!_.isEqual(a, b)) {
						updatedStatsById[currentProbe.client] = this.serializeProbeStats(currentProbe.stats);
					}

					return true;
				}

				return undefined;
			});

			if (!probesEqualExceptStats) {
				updatedProbesIds.push(currentProbe.client);
			}
		}

		// If there are no changes, we just send a keep-alive ping and stats...
		if (!updatedProbesIds.length && !previousProbesMap.size) {
			if (previousTimestamp) {
				nodeData.changeTimestamp = previousTimestamp;
			}

			// ...and occasionally also refresh the TTL by resetting it.
			if (nodeData.revalidateTimestamp - remoteTimestamp > this.remoteDataTtl / 2) {
				await this.setRemoteNodeData(this.nodeId, nodeData);
			}

			this.handleUpdate(nodeData);

			const message: Record<string, string> = {
				[MESSAGE_TYPES.ALIVE]: nodeData.revalidateTimestamp.toString(),
			};

			if (Object.keys(updatedStatsById).length) {
				message[MESSAGE_TYPES.STATS] = JSON.stringify(updatedStatsById);
			}

			await this.publishEvent(message);
			return;
		}

		// If there are changes, we reset the data and send the diff.
		const message: Record<string, string> = {
			[MESSAGE_TYPES.ALIVE]: nodeData.revalidateTimestamp.toString(),
		};

		if (Object.keys(updatedStatsById).length) {
			message[MESSAGE_TYPES.STATS] = JSON.stringify(updatedStatsById);
		}

		if (previousProbesMap.size) {
			message[MESSAGE_TYPES.REMOVE] = [ ...previousProbesMap.keys() ].join();
		}

		if (updatedProbesIds.length) {
			message[MESSAGE_TYPES.UPDATE] = updatedProbesIds.join();
		}

		this.handleUpdate(nodeData);
		await this.setRemoteNodeData(this.nodeId, nodeData);
		await this.publishEvent(message);
	}

	async syncPull () {
		// Returns an *inclusive* range starting from this.lastReadEventId
		const events = await this.redis.xRange(this.remoteEventsStream, this.lastReadEventId, '+');
		const hasMissedEvents = events[0]?.id !== this.lastReadEventId;

		if (!hasMissedEvents) {
			events.shift(); // Already processed in the previous batch.
		}

		const eventsToProcess = events.filter(event => event.message[MESSAGE_TYPES.NODE] !== this.nodeId);

		if (!eventsToProcess.length) {
			return;
		}

		const eventsByNode = _.groupBy(eventsToProcess, event => event.message[MESSAGE_TYPES.NODE]);

		await Promise.all(Object.entries(eventsByNode).map(([ nodeId, nodeEvents ]) => {
			const changes: NodeChanges = {
				nodeId,
				revalidateTimestamp: undefined,
				reloadNode: hasMissedEvents,
				removeProbes: new Set(),
				updateProbes: new Set(),
				updateStats: new Map(),
			};

			if (changes.reloadNode) {
				return changes;
			}

			for (const event of nodeEvents) {
				for (const [ key, value ] of Object.entries(event.message)) {
					switch (key) {
						case MESSAGE_TYPES.ALIVE:
							changes.revalidateTimestamp = Number(value);
							break;

						case MESSAGE_TYPES.RELOAD:
							changes.reloadNode = true;
							return changes;

						case MESSAGE_TYPES.REMOVE:
							value.split(',').forEach(id => changes.removeProbes.add(id));
							break;

						case MESSAGE_TYPES.UPDATE:
							value.split(',').forEach(id => changes.updateProbes.add(id));
							break;

						case MESSAGE_TYPES.STATS:
							Object.entries(JSON.parse(value) as Record<string, string>).forEach(([ id, statsString ]) => {
								changes.updateStats.set(id, this.unserializeProbeStats(statsString));
							});

							break;
					}
				}
			}

			return changes;
		}).map(async (changes: NodeChanges) => {
			const nodeData = this.nodeData.get(changes.nodeId);

			if (!nodeData || changes.reloadNode || changes.updateProbes.size > 5) {
				const newNodeData = await this.getRemoteNodeData(changes.nodeId);

				if (newNodeData) {
					this.handleUpdate(newNodeData);
				}

				return;
			}

			const probesById = _.pickBy(nodeData.probesById, ((probe) => {
				return !changes.removeProbes.has(probe.client);
			}));

			changes.updateStats.forEach((stats, id) => {
				if (probesById[id]) {
					probesById[id]!.stats = stats;
				}
			});

			if (changes.updateProbes.size) {
				const paths = Array.from(changes.updateProbes).map(probeId => `$.probesById['${probeId}']`);
				const newProbesByPath = await this.getRemoteNodeDataAtPaths<Probe>(changes.nodeId, paths);

				if (newProbesByPath) {
					newProbesByPath.forEach((probe) => {
						if (probe) {
							probesById[probe.client] = probe;
						}
					});
				}
			}

			const newNodeData: NodeData = {
				...nodeData,
				...changes.revalidateTimestamp ? { revalidateTimestamp: changes.revalidateTimestamp } : {},
				probesById,
			};

			this.handleUpdate(newNodeData);
		}));

		this.lastReadEventId = events.at(-1)!.id;
	}

	async sync () {
		return Promise.all([
			this.syncPush(),
			this.syncPull(),
		]);
	}

	schedulePush () {
		clearTimeout(this.pushTimer);

		this.pushTimer = setTimeout(() => {
			this.syncPush()
				.finally(() => this.schedulePush())
				.catch(error => this.logger.error(error));
		}, this.syncInterval).unref();
	}

	schedulePull () {
		clearTimeout(this.pullTimer);

		this.pullTimer = setTimeout(() => {
			this.syncPull()
				.finally(() => this.schedulePull())
				.catch(error => this.logger.error(error));
		}, this.syncInterval).unref();
	}

	scheduleSync () {
		this.schedulePush();
		this.schedulePull();
	}

	unscheduleSync () {
		clearTimeout(this.pushTimer);
		clearTimeout(this.pullTimer);
	}
}
