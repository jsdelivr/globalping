const probes = () => ({
  data() {
    return {
      probes: [],
    };
  },
  created() {
    this.fetchProbes();
  },
  methods: {
    getReadyColor(index) {
      const probe = this.probes[index];
      if (!probe.status) {
        return 'green';
      }
      return probe.status !== 'ready' ? 'orange' : 'green';
    },
    getReadyStatus(index) {
      const probe = this.probes[index];
      return probe.status ? `[${probe.status.toUpperCase()}]` : '';
    },
    getHost(index) {
      const probe = this.probes[index];
      return probe.host ? `[${probe.host}]` : '';
    },
    getIpAddress(index) {
      const probe = this.probes[index];
      return probe.ipAddress ? `[${probe.ipAddress}]` : '';
    },
    parsedLocation(index) {
      const probe = this.probes[index];
      if (!probe) {
        return;
      }

      const city = probe.location.country === 'US' ? `${probe.location.city} (${probe.location.state})` : probe.location.city;

      return `${city}, ${probe.location.country}, ${probe.location.continent}, ${probe.location.asn}`;
    },
    getTags(index) {
      const probe = this.probes[index];
      return probe.tags.length ? `(${probe.tags.join(', ')})` : '';
    },
    async fetchProbes() {
      const adminKey = new URLSearchParams(window.location.search).get('adminkey');
      const url = `/v1/probes?adminkey=${adminKey}`;
      const probes = await (await fetch(url)).json();
      const sortNonReadyFirst = (probe1, probe2) => {
        if (probe1.status === 'ready' && probe2.status !== 'ready') {
          return 1;
        } else if (probe1.status !== 'ready' && probe2.status === 'ready') {
          return -1;
        } else {
          return 0;
        }
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
            [{{ probe.version }}] {{ getReadyStatus(index) }} {{ getHost(index) }} {{ getIpAddress(index) }} {{ parsedLocation(index) }} -- {{ probe.location.network }} {{ getTags(index) }}
          </div>
        </li>
      </ul>
    </div>
  `
});

Vue.createApp(probes()).mount('#probes');
