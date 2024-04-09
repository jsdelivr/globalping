import type { Knex } from 'knex';
import { getIndex } from '../probe/builder.js';
import type { Probe } from '../probe/types.js';
import { AdoptedProbes } from './adopted-probes.js';
import type { fetchRawProbes as serverFetchRawProbes } from './ws/server.js';

export class ProbeOverride {
	private readonly adoptedProbes: AdoptedProbes;

	constructor (
		private readonly sql: Knex,
		private readonly fetchRawProbes: typeof serverFetchRawProbes,
	) {
		this.adoptedProbes = new AdoptedProbes(this.sql, this.fetchRawProbes);
	}

	async syncDashboardData () {
		await this.adoptedProbes.syncDashboardData();
	}

	scheduleSync () {
		this.adoptedProbes.scheduleSync();
	}

	getUpdatedLocation (probe: Probe) {
		return this.adoptedProbes.getUpdatedLocation(probe);
	}

	addOverrideData (probes: Probe[]) {
		return probes.map((probe) => {
			const adopted = this.adoptedProbes.getByIp(probe.ipAddress);

			if (!adopted) {
				return probe;
			}

			const isCustomCity = adopted.isCustomCity;
			const hasUserTags = adopted.tags && adopted.tags.length;

			if (!isCustomCity && !hasUserTags) {
				return probe;
			}

			const newLocation = this.adoptedProbes.getUpdatedLocation(probe);

			const newTags = this.adoptedProbes.getUpdatedTags(probe);

			return {
				...probe,
				location: newLocation,
				tags: newTags,
				index: getIndex(newLocation, newTags),
			};
		});
	}
}
