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
      return probe.ready ? 'green' : 'orange';
    },
    getReadyStatus(index) {
      const probe = this.probes[index];
      return probe.ready ? '[READY]' : '[NOT READY]';
    },
    parsedLocation(index) {
      const probe = this.probes[index];
      if (!probe) {
        return;
      }

      const city = probe.location.country === 'US' ? `${probe.location.city} (${probe.location.state})` : probe.location.city;

      return `${city}, ${probe.location.country}, ${probe.location.continent}, ${probe.location.asn}`;
    },
    async fetchProbes() {
      const url = '/v1/probes';
      this.probes = await (await fetch(url)).json();
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
            [{{ probe.version }}] {{ getReadyStatus(index) }} {{ parsedLocation(index) }} -- {{ probe.location.network }}
            </div>
        </li>
      </ul>
    </div>
  `
});

Vue.createApp(probes()).mount('#probes');
