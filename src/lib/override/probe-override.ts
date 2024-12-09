import type { Probe } from '../../probe/types.js';
import type { AdoptedProbes } from './adopted-probes.js';
import type { AdminData } from './admin-data.js';

export class ProbeOverride {
	constructor (
		private readonly adoptedProbes: AdoptedProbes,
		private readonly adminData: AdminData,
	) {}

	async fetchDashboardData () {
		await Promise.all([
			this.adoptedProbes.fetchAdoptions(),
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
		return { ...probe.location, ...adminLocation, ...adoptedLocation };
	}

	addAdminData (probes: Probe[]) {
		return this.adminData.getUpdatedProbes(probes);
	}

	addAdoptedData (probes: Probe[]) {
		return this.adoptedProbes.getUpdatedProbes(probes);
	}
}
