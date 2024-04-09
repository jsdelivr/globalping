import { getIndex } from '../probe/builder.js';
import type { Probe } from '../probe/types.js';
import type { AdoptedProbes } from './adopted-probes.js';

export class ProbeOverride {
	constructor (private readonly adoptedProbes: AdoptedProbes) {}

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
