import type { Knex } from 'knex';
import { scopedLogger } from './logger.js';
import { client } from './sql/client.js';
import { fetchSockets } from './ws/server.js';

const logger = scopedLogger('adopted-probes');

const TABLE_NAME = 'adopted_probes';

type AdoptedProbe = {
	ip: string;
	uuid: string;
	lastSyncDate: string;
}

export class AdoptedProbes {
	private connectedIpToUuid: Map<string, string> = new Map();
	private connectedUuidToIp: Map<string, string> = new Map();

	constructor (
		private readonly sql: Knex,
		private readonly fetchWsSockets: typeof fetchSockets,
	) {}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, 5000);
	}

	async syncDashboardData () {
		const allSockets = await this.fetchWsSockets();
		this.connectedIpToUuid = new Map(allSockets.map(socket => [ socket.data.probe.ipAddress, socket.data.probe.uuid ]));
		this.connectedUuidToIp = new Map(allSockets.map(socket => [ socket.data.probe.uuid, socket.data.probe.ipAddress ]));

		const adoptedProbes = await this.sql(TABLE_NAME).select<AdoptedProbe[]>('ip', 'uuid', 'lastSyncDate');
		await Promise.all(adoptedProbes.map(({ ip, uuid }) => this.syncProbeIds(ip, uuid)));
		await Promise.all(adoptedProbes.map(({ ip, lastSyncDate }) => this.updateSyncDate(ip, lastSyncDate)));
	}

	private async syncProbeIds (ip: string, uuid: string) {
		const connectedUuid = this.connectedIpToUuid.get(ip);

		if (connectedUuid && connectedUuid === uuid) { // ip and uuid are synced
			return;
		}

		if (connectedUuid && connectedUuid !== uuid) { // uuid was found, but it is outdated
			await this.updateUuid(ip, connectedUuid);
			return;
		}

		const connectedIp = this.connectedUuidToIp.get(uuid);

		if (connectedIp) { // data was found by uuid, but not found by ip, therefore ip is outdated
			await this.updateIp(connectedIp, uuid);
		}
	}

	private async updateSyncDate (ip: string, lastSyncDate: string) {
		if (this.isToday(lastSyncDate)) { // date is already synced
			return;
		}

		const probeIsConnected = this.connectedIpToUuid.has(ip);

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

export const adoptedProbes = new AdoptedProbes(client, fetchSockets);
