import type { Knex } from 'knex';
import { scopedLogger } from '../logger.js';
import { client } from '../sql/client.js';

const logger = scopedLogger('adopted-probes');

type AdoptedProbe = {
  ip: string;
  uuid: string;
  city: string;
}

export class AdoptedProbes {
	private adoptedProbesByIp: Map<AdoptedProbe['ip'], Omit<AdoptedProbe, 'ip'>> = new Map();
	private adoptedProbesByUuid: Map<AdoptedProbe['uuid'], Omit<AdoptedProbe, 'uuid'>> = new Map();

	constructor (private readonly sql: Knex) {}

	async startSync () {
		await this.syncDashboardData();
		this.scheduleSync();
	}

	async syncProbeData (probeIp: string, probeUuid: string) {
		const adoptedProbeByIp = this.adoptedProbesByIp.get(probeIp);

		if (adoptedProbeByIp && adoptedProbeByIp.uuid === probeUuid) { // Probe is synced
			return;
		} else if (adoptedProbeByIp) { // Uuid is wrong
			await this.updateUuid(probeIp, probeUuid);
			return;
		}

		const adoptedProbeByUuid = this.adoptedProbesByUuid.get(probeUuid);

		if (adoptedProbeByUuid) { // Probe not found by ip but found by uuid, ip is wrong
			await this.updateIp(probeIp, probeUuid);
		}
	}

	private async updateUuid (ip: string, uuid: string) {
		await this.sql('adopted_probes').where({ ip }).update({ uuid });
	}

	private async updateIp (ip: string, uuid: string) {
		await this.sql('adopted_probes').where({ uuid }).update({ ip });
	}

	private async syncDashboardData () {
		const probes = await this.sql.select<AdoptedProbe[]>('ip', 'uuid').from('adopted_probes');
		this.adoptedProbesByIp = new Map(probes.map(probe => [ probe.ip, { uuid: probe.uuid, city: '' }]));
		this.adoptedProbesByUuid = new Map(probes.map(probe => [ probe.uuid, { ip: probe.ip, city: '' }]));
		console.log('this.adoptedProbes', this.adoptedProbesByIp);
	}

	scheduleSync () {
		setTimeout(() => {
			this.syncDashboardData()
				.finally(() => this.scheduleSync())
				.catch(error => logger.error(error));
		}, 5000);
	}
}

export const adoptedProbes = new AdoptedProbes(client);
