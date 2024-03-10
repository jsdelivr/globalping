import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import TTLCache from '@isaacs/ttlcache';
import { scopedLogger } from '../logger.js';
import type { WsServerNamespace } from './server.js';
import type { Probe } from '../../probe/types.js';
import type winston from 'winston';
import type { AdoptedProbes } from '../adopted-probes.js';
import { getIndex } from '../../probe/builder.js';

type NodeData = {
	nodeId: string;
	probes: Probe[];
	timestamp: number;
};

export class SyncedProbeList extends EventEmitter {
	syncInterval = 1000;
	syncTimeout = 5000;

	readonly localUpdateEvent = 'synced-probe-list:local-update';
	readonly remoteUpdateEvent = 'synced-probe-list:remote-update';

	private logger: winston.Logger;
	private rawProbes: Probe[];
	private probes: Probe[];
	private oldest: number;
	private timer: NodeJS.Timeout | undefined;

	private readonly nodeId: string;
	private readonly nodeData: TTLCache<string, NodeData>;

	constructor (private readonly ioNamespace: WsServerNamespace, private readonly adoptedProbes: AdoptedProbes) {
		super();
		this.nodeId = randomBytes(8).toString('hex');
		this.logger = scopedLogger('synced-probe-list', this.nodeId);
		this.rawProbes = [];
		this.probes = [];
		this.oldest = Infinity;

		this.nodeData = new TTLCache<string, NodeData>({
			noDisposeOnSet: true,
			dispose: (nodeData) => {
				this.logger.info(`Removed node ${nodeData.nodeId}.`);
				this.updateProbes();
			},
		});

		this.ioNamespace.on(this.remoteUpdateEvent, message => this.handleUpdate(message as NodeData));
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

	getProbes (): Probe[] {
		return this.probes.slice();
	}

	getRawProbes (): Probe[] {
		return this.rawProbes.slice();
	}

	private updateProbes () {
		const probes = [];
		let oldest = Infinity;

		for (const [ , entry ] of this.nodeData.entries()) {
			probes.push(...entry.probes);

			if (entry.timestamp < oldest) {
				oldest = entry.timestamp;
			}
		}

		this.rawProbes = probes;
		this.probes = addAdoptedProbesData(this.adoptedProbes, probes);
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

	async sync () {
		const sockets = await this.ioNamespace.local.fetchSockets();

		const message = {
			nodeId: this.nodeId,
			probes: sockets.map(socket => socket.data.probe),
			timestamp: Date.now(),
		};

		this.ioNamespace.serverSideEmit(this.remoteUpdateEvent, message);
		this.handleUpdate(message);
	}

	scheduleSync () {
		clearTimeout(this.timer);

		this.timer = setTimeout(() => {
			this.sync()
				.finally(() => this.scheduleSync())
				.catch(error => this.logger.error(error));
		}, this.syncInterval).unref();
	}
}

const addAdoptedProbesData = (adoptedProbes: AdoptedProbes, probes: Probe[]) => {
	return probes.map((probe) => {
		const adopted = adoptedProbes.getByIp(probe.ipAddress);

		if (!adopted) {
			return probe;
		}

		const isCustomCity = adopted.isCustomCity;
		const hasUserTags = adopted.tags && adopted.tags.length;

		if (!isCustomCity && !hasUserTags) {
			return probe;
		}

		const newLocation = adoptedProbes.getUpdatedLocation(probe);

		const newTags = adoptedProbes.getUpdatedTags(probe);

		return {
			...probe,
			location: newLocation,
			tags: newTags,
			index: getIndex(newLocation, newTags),
		};
	});
};
