const probes = () => ({
	data () {
		return {
			probes: [],
		};
	},
	created () {
		this.fetchProbes();
	},
	methods: {
		getReadyColor (index) {
			const probe = this.probes[index];

			if (!probe.status) {
				return 'green';
			}

			return probe.status !== 'ready' ? 'orange' : 'green';
		},
		getNodeVersion (index) {
			const probe = this.probes[index];
			return probe.nodeVersion ? `[${probe.nodeVersion}]` : '';
		},
		getReadyStatus (index) {
			const probe = this.probes[index];
			return probe.status ? `[${probe.status.toUpperCase()}]` : '';
		},
		getHost (index) {
			const probe = this.probes[index];
			return probe.host ? `[${probe.host}]` : '';
		},
		getIpAddresses (index) {
			const probe = this.probes[index];
			return probe.ipAddress ? `[${[ probe.ipAddress, ...probe.altIpAddresses ].join(', ')}]` : '';
		},
		parsedLocation (index) {
			const probe = this.probes[index];

			if (!probe) {
				return;
			}

			const city = probe.location.country === 'US' ? `${probe.location.city} (${probe.location.state})` : probe.location.city;

			return `${city}, ${probe.location.country}, ${probe.location.continent}, ${probe.location.asn}`;
		},
		getTags (index) {
			const probe = this.probes[index];
			return probe.tags.length ? `(${probe.tags.join(', ')})` : '';
		},
		getIsIPv4Supported (index) {
			const probe = this.probes[index];
			return probe.isIPv4Supported === undefined ? '' : `IPv4: [${probe.isIPv4Supported}]`;
		},
		getIsIPv6Supported (index) {
			const probe = this.probes[index];
			return probe.isIPv6Supported === undefined ? '' : `IPv6: [${probe.isIPv6Supported}]`;
		},
		async fetchProbes () {
			const adminKey = new URLSearchParams(window.location.search).get('adminkey');
			const url = `/v1/probes?adminkey=${adminKey}`;
			const probes = await (await fetch(url)).json();
			const sortNonReadyFirst = (probe1, probe2) => {
				if (probe1.status === 'ready' && probe2.status !== 'ready') {
					return 1;
				} else if (probe1.status !== 'ready' && probe2.status === 'ready') {
					return -1;
				}

				return 0;
			};
			this.probes = probes.sort(sortNonReadyFirst);
		},
	},
	template: `
		<div>
			<h2>
				{{ probes.length }} probes available
			</h2>
			<ul>
				<li v-for="(probe, index) in probes">
					<div :style="{ color: getReadyColor(index) }">
						[{{ probe.version }}] {{ getNodeVersion(index) }} {{ getReadyStatus(index) }} {{ getIsIPv4Supported(index) }} {{ getIsIPv6Supported(index) }} {{ getHost(index) }} {{ getIpAddresses(index) }} {{ parsedLocation(index) }} -- {{ probe.location.network }} {{ getTags(index) }}
					</div>
				</li>
			</ul>
		</div>
	`,
});

Vue.createApp(probes()).mount('#probes');
