import { getIndex } from '../probe/builder.js';
import type { Probe } from '../probe/types.js';
import type { AdoptedProbes } from './adopted-probes.js';
import type { AdminData } from './admin-data.js';

export class ProbeOverride {
	constructor (
		private readonly adoptedProbes: AdoptedProbes,
		private readonly adminData: AdminData,
	) {}

	async syncDashboardData () {
		await Promise.all([
			this.adoptedProbes.syncDashboardData(),
			this.adminData.syncDashboardData(),
		]);
	}

	scheduleSync () {
		this.adoptedProbes.scheduleSync();
		this.adminData.scheduleSync();
	}

	getUpdatedLocation (probe: Probe) {
		const adminLocation = this.adminData.getUpdatedLocation(probe);
		const adoptedLocation = this.adoptedProbes.getUpdatedLocation(probe);
		return { ...adminLocation, ...adoptedLocation };
	}

	addAdminData (probes: Probe[]) {
		// Implement
		return probes;
	}

	addAdoptedData (probes: Probe[]) {
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
