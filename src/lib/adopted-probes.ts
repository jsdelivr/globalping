import type { Knex } from 'knex';
import Bluebird from 'bluebird';
import _ from 'lodash';

import { scopedLogger } from './logger.js';
import { client } from './sql/client.js';
import { fetchConnectedSockets } from './ws/server.js';
import type { Probe } from '../probe/types.js';

const logger = scopedLogger('adopted-probes');

const TABLE_NAME = 'adopted_probes';

type AdoptedProbe = {
	ip: string;
	uuid: string;
	lastSyncDate: string;
	tags: string[];
	isCustomCity: boolean;
	status: string;
	version: string;
	country: string;
	city: string;
	latitude: number;
	longitude: number;
	asn: number;
	network: string;
}

export class AdoptedProbes {
	private connectedIpToProbe: Map<string, Probe> = new Map();
	private connectedUuidToIp: Map<string, string> = new Map();
	private adoptedIpToProbe: Map<string, AdoptedProbe> = new Map();
	private readonly adoptedFieldToConnectedField = {
		status: {
			connectedField: 'status',
			shouldUpdateIfCustomCity: true,
		},
		version: {
			connectedField: 'version',
			shouldUpdateIfCustomCity: true,
		},
		asn: {
			connectedField: 'location.asn',
			shouldUpdateIfCustomCity: true,
		},
		network: {
			connectedField: 'location.network',
			shouldUpdateIfCustomCity: true,
		},
		country: {
			connectedField: 'location.country',
			shouldUpdateIfCustomCity: false,
		},
		city: {
			connectedField: 'location.city',
			shouldUpdateIfCustomCity: false,
		},
		latitude: {
			connectedField: 'location.latitude',
			shouldUpdateIfCustomCity: false,
		},
		longitude: {
			connectedField: 'location.longitude',
			shouldUpdateIfCustomCity: false,
		},
	};

	constructor (
		private readonly sql: Knex,
		private readonly fetchWsSockets: typeof fetchConnectedSockets,
	) {}

	getAdoptedIpToProbe () {
		return this.adoptedIpToProbe;
	}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, 60_000);
	}

	async syncDashboardData () {
		const allSockets = await this.fetchWsSockets();
		this.connectedIpToProbe = new Map(allSockets.map(socket => [ socket.data.probe.ipAddress, socket.data.probe ]));
		this.connectedUuidToIp = new Map(allSockets.map(socket => [ socket.data.probe.uuid, socket.data.probe.ipAddress ]));

		const adoptedProbes = await this.sql(TABLE_NAME).select<AdoptedProbe[]>('ip', 'uuid', 'lastSyncDate', 'isCustomCity', 'tags', ...Object.keys(this.adoptedFieldToConnectedField));
		this.adoptedIpToProbe = new Map(adoptedProbes.map(probe => [ probe.ip, probe ]));
		await Bluebird.map(adoptedProbes, ({ ip, uuid }) => this.syncProbeIds(ip, uuid), { concurrency: 8 });
		await Bluebird.map(adoptedProbes, adoptedProbe => this.syncProbeData(adoptedProbe), { concurrency: 8 });
		await Bluebird.map(adoptedProbes, ({ ip, lastSyncDate }) => this.updateSyncDate(ip, lastSyncDate), { concurrency: 8 });
	}

	private async syncProbeIds (ip: string, uuid: string) {
		const connectedProbe = this.connectedIpToProbe.get(ip);

		if (connectedProbe && connectedProbe.uuid === uuid) { // ip and uuid are synced
			return;
		}

		if (connectedProbe && connectedProbe.uuid !== uuid) { // uuid was found, but it is outdated
			await this.updateUuid(ip, connectedProbe.uuid);
			return;
		}

		const connectedIp = this.connectedUuidToIp.get(uuid);

		if (connectedIp) { // data was found by uuid, but not found by ip, therefore ip is outdated
			await this.updateIp(connectedIp, uuid);
		}
	}

	private async syncProbeData (adoptedProbe: AdoptedProbe) {
		const connectedProbe = this.connectedIpToProbe.get(adoptedProbe.ip);
		const isCustomCity = adoptedProbe.isCustomCity;

		if (!connectedProbe) {
			return;
		}

		const updateObject: Record<string, string | number> = {};

		Object.entries(this.adoptedFieldToConnectedField).forEach(([ adoptedField, { connectedField, shouldUpdateIfCustomCity }]) => {
			if (isCustomCity && !shouldUpdateIfCustomCity) {
				return;
			}

			const adoptedValue = _.get(adoptedProbe, adoptedField) as string | number;
			const connectedValue = _.get(connectedProbe, connectedField) as string | number;

			if (adoptedValue !== connectedValue) {
				updateObject[adoptedField] = connectedValue;
			}
		});

		if (!_.isEmpty(updateObject)) {
			await this.updateProbeData(adoptedProbe.ip, updateObject);
		}
	}

	private async updateSyncDate (ip: string, lastSyncDate: string) {
		if (this.isToday(lastSyncDate)) { // date is already synced
			return;
		}

		const probeIsConnected = this.connectedIpToProbe.has(ip);

		if (probeIsConnected) { // date is old, but probe is connected, therefore updating the sync date
			await this.updateLastSyncDate(ip);
			return;
		}

		if (this.isMoreThan30DaysAgo(lastSyncDate)) { // probe wasn't connected for >30 days, removing adoption
			await this.deleteAdoptedProbe(ip);
		}
	}

	private async updateUuid (ip: string, uuid: string) {
		await this.sql(TABLE_NAME).where({ ip }).update({ uuid });
	}

	private async updateIp (ip: string, uuid: string) {
		await this.sql(TABLE_NAME).where({ uuid }).update({ ip });
	}

	private async updateProbeData (ip: string, updateObject: Record<string, string | number>) {
		await this.sql(TABLE_NAME).where({ ip }).update(updateObject);
	}

	private async updateLastSyncDate (ip: string) {
		await this.sql(TABLE_NAME).where({ ip }).update({ lastSyncDate: new Date() });
	}

	private async deleteAdoptedProbe (ip: string) {
		await this.sql(TABLE_NAME).where({ ip }).delete();
	}

	private isToday (dateString: string) {
		const currentDate = new Date();
		const currentDateString = currentDate.toISOString().split('T')[0];
		return dateString === currentDateString;
	}

	private isMoreThan30DaysAgo (dateString: string) {
		const inputDate = new Date(dateString);
		const currentDate = new Date();

		const timeDifference = currentDate.getTime() - inputDate.getTime();
		const daysDifference = timeDifference / (24 * 3600 * 1000);

		return daysDifference > 30;
	}
}

export const adoptedProbes = new AdoptedProbes(client, fetchConnectedSockets);
