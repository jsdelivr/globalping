import type { ExtendedProbeLocationWithOverrides, SocketProbe } from '../../probe/types.js';
import type { AdoptedProbes } from './adopted-probes.js';
import type { AdminData } from './admin-data.js';

export class ProbeOverride {
	constructor (
		private readonly adoptedProbes: AdoptedProbes,
		private readonly adminData: AdminData,
	) {}

	async fetchDashboardData () {
		await Promise.all([
			this.adoptedProbes.fetchDProbes(),
			this.adminData.syncDashboardData(),
		]);
	}

	scheduleSync () {
		this.adoptedProbes.scheduleSync();
		this.adminData.scheduleSync();
	}

	getUpdatedLocation (probe: SocketProbe): ExtendedProbeLocationWithOverrides {
		const adminLocation = this.adminData.getUpdatedLocation(probe);
		const adoptedLocation = this.adoptedProbes.getUpdatedLocation(probe, adminLocation);
		return { ...probe.location, ...adminLocation, ...adoptedLocation, hasOverridesApplied: true };
	}

	addAdminData (probes: SocketProbe[]) {
		return this.adminData.getUpdatedProbes(probes);
	}

	addAdoptedData (probes: SocketProbe[]) {
		return this.adoptedProbes.getUpdatedProbes(probes);
	}
}
